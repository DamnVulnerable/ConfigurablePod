# Configurable Pod Operator

This operator showcases a new hacking technique against kubernetes custom controllers.

## Setup

```bash
kubectl apply -f - <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: production-config
type: Opaque
data:
  image: bmdpbng=
---
apiVersion: damnvulerable.io/v1
kind: ConfigurablePod
metadata:
  name: example-configurablepod
spec:
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
      - name: example-container
        image: secret:default:production-config:image
EOF
```