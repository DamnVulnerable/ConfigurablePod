const k8sOperator = require('@dot-i/k8s-operator');
const path = require('path');
const k8s = require('@kubernetes/client-node');
const { log } = require('console');
const debug = require('debug')('operator')

const Operator = k8sOperator.default;
const { ResourceEventType } = k8sOperator;

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


// Sustitute any string that follows the format secret:namespace:secretName:key with the value of the secret
const refRegex = /secret:([a-z0-9-]+):([a-z0-9-]+):([a-z0-9-]+)/;

async function resolveReferences(obj) {
    for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            // If the value is an object, recurse
            await resolveReferences(obj[key]);
        } else if (refRegex.test(obj[key])) {
            // If the value matches the old value, replace it
            try {
                const [_, namespace, secretName, secretKey] = refRegex.exec(obj[key]);
                const response = await k8sApi.readNamespacedSecret(secretName, namespace);
                const secret = response.body.data;
                const secretValue = Buffer.from(secret[secretKey].toString(), "base64").toString();
                obj[key] = secretValue;
            } catch (e) {
                log('Error reading secret: %s', e);
            }
        }
    }
    log(obj);
    return obj;
}

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
                    const template = await resolveReferences(e.object.spec.template);
                    await k8sApi.createNamespacedPod(e.object.metadata.namespace, {...template,
                        metadata: {
                            name: e.object.metadata.name,
                            ownerReferences: [{
                                apiVersion: 'v1',
                                blockOwnerDeletion: true,
                                controller: true,
                                kind: 'ConfigurablePod',
                                name: e.object.metadata.name,
                                uid: e.object.metadata.uid
                            }]
                        }
                    });
                    break;
                case ResourceEventType.Modified:
                    debug('Modified: %s', e.object.metadata.name);
                    await k8sApi.deleteNamespacedPod(e.object.metadata.name, e.object.metadata.namespace);
                    await k8sApi.createNamespacedPod(e.object.metadata.namespace, {...template,
                        metadata: {
                            name: e.object.metadata.name,
                            ownerReferences: [{
                                apiVersion: 'v1',
                                blockOwnerDeletion: true,
                                controller: true,
                                kind: 'ConfigurablePod',
                                name: e.object.metadata.name,
                                uid: e.object.metadata.uid
                            }]
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
