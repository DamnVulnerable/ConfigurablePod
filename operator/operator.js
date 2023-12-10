const k8sOperator = require('@dot-i/k8s-operator');
const path = require('path');
const k8s = require('@kubernetes/client-node');
const debug = require('debug')('operator')

const Operator = k8sOperator.default;
const { ResourceEventType } = k8sOperator;

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

class ConfigurablePodOperator extends Operator {

    async init() {
        debug('Starting operator...');

        const crdFile = path.resolve(__dirname, 'crds', 'configurable-pod.yaml');
        const { group, versions, plural } = await this.registerCustomResourceDefinition(crdFile);

        debug('Watching for group: %s, version: %s, plural: %s', group, versions[0].name, plural);
        await this.watchResource(group, versions[0].name, plural, async (e) => {
            switch (e.type) {
                case ResourceEventType.Added:
                    debug('Added: %s', e.object.metadata.name);
                    await k8sApi.createNamespacedPod(e.object.metadata.namespace, {...e.object.spec.template,
                        metadata: {
                            name: e.object.metadata.name
                        }
                    });
                    break;
                case ResourceEventType.Modified:
                    debug('Modified: %s', e.object.metadata.name);
                    await k8sApi.deleteNamespacedPod(e.object.metadata.name, e.object.metadata.namespace);
                    await k8sApi.createNamespacedPod(e.object.metadata.namespace, {...e.object.spec.template,
                        metadata: {
                            name: e.object.metadata.name
                        }
                    });
                    break;
                case ResourceEventType.Deleted:
                    debug('Deleted: %s', e.object.metadata.name);
                    break;
            }
        });
    }
}

module.exports = {
    ConfigurablePodOperator
}