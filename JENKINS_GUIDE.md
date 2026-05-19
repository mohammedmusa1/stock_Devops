# Ultra-Lightweight Jenkins + k3s + ArgoCD GitOps Deployment Guide

Deploying Jenkins inside a Kubernetes cluster on an AWS `t3.micro` (1 vCPU, 1 GB RAM) is a guaranteed out-of-memory (OOM) disaster. To keep resource usage extremely low while maintaining an enterprise-grade CI/CD pipeline, we run **Docker-based Jenkins on the host** outside of Kubernetes, using strict memory capping, host-socket sharing, and swap allocation.

---

## 🏛️ Architectural Overview

By sharing the **Host's Docker Socket** and the **Host's K3s Kubeconfig** with the Jenkins container, we eliminate the need for a separate Jenkins build agent or an in-container Docker daemon. This saves over **1.5 GB of RAM**!

```
┌───────────────────────────────── AWS EC2 (t3.micro) ─────────────────────────────────┐
│                                                                                      │
│ ┌──────────────────┐           ┌───────────────────┐           ┌───────────────────┐ │
│ │  GitHub Webhook  │ ────────> │ Jenkins Container │ ────────> │   k3s Cluster     │ │
│ │  (Push Event)    │           │ (Master / Port 8081)│         │   (Control Plane) │ │
│ └──────────────────┘           └───────────────────┘           └─────────┬─────────┘ │
│                                  │               │                       │           │
│                                  │ (Mounts       │ (Mounts               │ (Controls│ │
│                                  │  Docker       │  Kubeconfig)          │  Pods)    │ │
│                                  │  Socket)      │                       ▼           │
│                                  ▼               ▼              ┌─────────────────┐  │
│                        ┌───────────────────┐ ┌───────────┐      │ stockdevops-app │  │
│                        │ Host Docker Engine│ │ K3s API   │      │ (Deployment in  │  │
│                        │ (Builds/Tags)     │ │ (6443)    │      │  stockdevops ns)│  │
│                        └───────────────────┘ └───────────┘      └─────────────────┘  │
│                                                                          ▲           │
│                                                                          │           │
│ ┌──────────────────┐           ┌───────────────────┐                     │ (Syncs)   │
│ │  GitOps Commit   │ <──────── │   ArgoCD Engine   │ ────────────────────┘           │
│ │ (values-prod.yaml)│          │  (Auto-Heal / Sync)│                                │
│ └──────────────────┘           └───────────────────┘                                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step 1: Host System Rescue (Configure Swap Space)

A standard `t3.micro` has exactly 1 GB of RAM. The Linux OS, K3s, ArgoCD, and Docker easily consume ~900 MB at rest. Before running Jenkins, you **MUST** create a 4 GB SWAP file on the host. This prevents Jenkins from being instantly terminated by the kernel's OOM-Killer.

Run these commands on your EC2 host:

```bash
# 1. Allocate a 4 GB file for Swap
sudo fallocate -l 4G /swapfile

# 2. Restrict permissions to root-only (security requirement)
sudo chmod 600 /swapfile

# 3. Format the file as Swap space
sudo mkswap /swapfile

# 4. Enable the swap space
sudo swapon /swapfile

# 5. Make the swap persistent across system reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 6. Verify swap is active (should display 4.0G of swap space)
free -h
```

---

## 🚀 Step 2: Spin Up Jenkins with Strict low-RAM Caps

To run Jenkins stably on `t3.micro`, we must severely cap the Java Virtual Machine (JVM) heap, disable heavy concurrent executors, use the extremely fast and lightweight **Serial Garbage Collector (SerialGC)**, and run as root to access the mounted Docker socket and kubeconfig without permission conflicts.

Run the following command on your EC2 host. Choose the networking mode that fits your setup:

### Option A: Host Network Mode (Recommended & Easiest)
By sharing the host's network, Jenkins automatically accesses K3s at `127.0.0.1:6443` without any proxy configurations. It maps to port **8081** directly on the host using the JVM httpPort flag.

```bash
docker run -d \
  --name jenkins \
  --network host \
  --restart always \
  -e JAVA_OPTS="-Xms128m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Dhudson.model.AbstractProject.FIFO=true" \
  -e JENKINS_OPTS="--httpPort=8081" \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/rancher/k3s/k3s.yaml:/root/.kube/config \
  --user root \
  jenkins/jenkins:lts
```

### Option B: Bridge Mode (Standard Docker Network)
If you prefer isolation, map port `8081` to the container's `8080`, mount the Kubeconfig, and use the `--add-host` flag to make the host accessible at `host.docker.internal`.

```bash
docker run -d \
  --name jenkins \
  -p 8081:8080 \
  -p 50000:50000 \
  --restart always \
  --add-host=host.docker.internal:host-gateway \
  -e JAVA_OPTS="-Xms128m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Dhudson.model.AbstractProject.FIFO=true" \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/rancher/k3s/k3s.yaml:/root/.kube/k3s-raw.yaml \
  --user root \
  jenkins/jenkins:lts
```

> [!NOTE]
> If you used **Option B (Bridge Mode)**, you must configure `kubectl` to point to the host gateway IP. Run this one-liner on the host:
> ```bash
> # Create the .kube directory and copy/edit the config inside the container
> docker exec -u 0 jenkins mkdir -p /root/.kube
> docker exec -u 0 jenkins sh -c "sed 's/127.0.0.1/host.docker.internal/g' /root/.kube/k3s-raw.yaml > /root/.kube/config"
> ```

---

## 🔎 Step 3: Install & Verify `kubectl` Inside Jenkins

We will download the statically compiled `kubectl` binary directly into the Jenkins container. It is tiny (~45MB) and has no external dependencies.

Run these commands on the host to setup `kubectl` inside Jenkins:

```bash
# 1. Download the latest stable kubectl binary into the running container
docker exec -u 0 jenkins curl -LO "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl"

# 2. Make the binary executable
docker exec -u 0 jenkins chmod +x kubectl

# 3. Move it to the system PATH inside the container
docker exec -u 0 jenkins mv kubectl /usr/local/bin/

# 4. Verify connection to the K3s cluster (should return cluster details successfully)
docker exec -u 0 jenkins kubectl cluster-info

# 5. Verify access to your specific deployment namespace
docker exec -u 0 jenkins kubectl get deployments -n stockdevops
```

---

## 🔒 Step 4: Configure Jenkins Initial Admin & Plugins

1. **Retrieve the Initial Admin Password**:
   ```bash
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
2. Navigate to `http://<your-ec2-ip>:8081` in your browser, enter the password, and choose **"Select plugins to install"**.
3. **De-select all recommended plugins** and only select the bare essentials to keep RAM utilization low:
   * **Git** (for repository checkout)
   * **Pipeline** (for Jenkinsfile support)
4. Create your admin user and finish the setup.
5. Go to **Manage Jenkins** -> **System** and set **# of executors** to exactly `1`. Capping executors prevents Jenkins from running concurrent builds, which would trigger immediate OOM errors on a `t3.micro`.

---

## ⛓️ Step 5: Create the Unified CI/CD Jenkinsfile

Create a file named `Jenkinsfile` at the root of your application repository. This pipeline is fully optimized, uses the host's Docker engine to build both NestJS API and NextJS Web applications, pushes them to Docker Hub, updates the GitOps chart repository, and executes an instant rollout restart.

Add the following file to your repository root:

```groovy
pipeline {
    agent any

    environment {
        // Docker Registry Details
        REGISTRY_CREDENTIALS_ID = 'docker-hub-credentials'
        API_IMAGE = 'mohammedmusa1/stockdevops-api'
        WEB_IMAGE = 'mohammedmusa1/stockdevops-web'
        
        // Kubernetes Targets
        K8S_NAMESPACE = 'stockdevops'
        DEPLOYMENT_NAME = 'stockdevops-app'
        
        // GitOps Repository Configuration
        GITOPS_REPO = 'github.com/mohammedmusa1/stock_Devops.git'
        GITOPS_CREDENTIALS_ID = 'github-pat-credentials'
    }

    options {
        // Avoid queue buildup and resource starvation
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
                script {
                    // Capture a short git SHA for tagging
                    env.GIT_SHA_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    echo "Starting build for Commit SHA: ${env.GIT_SHA_SHORT}"
                }
            }
        }

        stage('Test & Audit') {
            steps {
                echo 'Running fast lints and audits...'
                // If dependencies are too heavy for t3.micro RAM, run only syntax linting
                sh 'npm run test --if-present'
            }
        }

        stage('Docker Build & Push') {
            steps {
                // Using host Docker engine via mounted socket — zero memory overhead inside container!
                withCredentials([usernamePassword(credentialsId: env.REGISTRY_CREDENTIALS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin'
                    
                    // 1. Build and push backend API
                    echo 'Building API Container...'
                    sh "docker build -t ${env.API_IMAGE}:${env.GIT_SHA_SHORT} -t ${env.API_IMAGE}:latest -f apps/api/Dockerfile ."
                    sh "docker push ${env.API_IMAGE}:${env.GIT_SHA_SHORT}"
                    sh "docker push ${env.API_IMAGE}:latest"
                    
                    // 2. Build and push frontend Web
                    echo 'Building Web Container...'
                    sh "docker build -t ${env.WEB_IMAGE}:${env.GIT_SHA_SHORT} -t ${env.WEB_IMAGE}:latest -f apps/web/Dockerfile ."
                    sh "docker push ${env.WEB_IMAGE}:${env.GIT_SHA_SHORT}"
                    sh "docker push ${env.WEB_IMAGE}:latest"
                }
            }
        }

        stage('GitOps manifest Update (CD)') {
            steps {
                // Checkout and commit the new version tag directly to GitOps Helm values
                withCredentials([usernamePassword(credentialsId: env.GITOPS_CREDENTIALS_ID, usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
                    sh """
                        # Configure Git credentials
                        git config --global user.email "jenkins-bot@stockdevops.com"
                        git config --global user.name "Jenkins CI-CD Automation Bot"
                        
                        # GitOps update: Replace tag in values-prod.yaml
                        # Note: Points to the local values-prod.yaml for ArgoCD application
                        sed -i 's/tag: .*/tag: "${env.GIT_SHA_SHORT}"/g' gitops/apps/stockdevops/values-prod.yaml
                        
                        # Add and commit the changes
                        git add gitops/apps/stockdevops/values-prod.yaml
                        git commit -m "chore(deploy): auto-release version ${env.GIT_SHA_SHORT} via Jenkins [skip ci]" || echo "No changes to commit"
                        
                        # Push to GitOps repository using token authentication
                        git push https://${GITHUB_USER}:${GITHUB_TOKEN}@${env.GITOPS_REPO} HEAD:main
                    """
                }
            }
        }

        stage('Kubernetes Deploy & Restart') {
            steps {
                echo 'Checking Kubernetes Cluster Connection...'
                sh 'kubectl cluster-info'
                
                // Option A: Restart deployment via direct rollout (Instant verification)
                echo 'Triggering rolling restart of Kubernetes Deployment...'
                sh "kubectl rollout restart deployment ${env.DEPLOYMENT_NAME} -n ${env.K8S_NAMESPACE}"
                
                // Option B: Verify roll out status
                sh "kubectl rollout status deployment/${env.DEPLOYMENT_NAME} -n ${env.K8S_NAMESPACE} --timeout=90s"
            }
        }
        
        stage('ArgoCD Webhook Trigger') {
            steps {
                echo 'Triggering ArgoCD Auto-Sync Webhook...'
                // If ArgoCD is set to auto-sync, it will sync automatically in 180 seconds.
                // We run a curl command to trigger ArgoCD to sync instantly, bypassing polling delay:
                sh """
                    curl -k -X POST \
                    -H "Content-Type: application/json" \
                    -d '{"ref": "refs/heads/main"}' \
                    https://localhost/api/v1/applications/stockdevops/sync || echo "Failed to trigger ArgoCD HTTP Sync. Relying on GitOps poll."
                """
            }
        }
    }

    post {
        always {
            echo 'Pruning Docker containers and images to free up t3.micro disk space...'
            sh 'docker image prune -f --filter "until=24h"'
        }
        success {
            echo "CI/CD Pipeline Succeeded!"
        }
        failure {
            echo "CI/CD Pipeline Failed. Check console logs."
        }
    }
}
```

---

## 🔗 Step 6: Configure Jenkins Credentials

To run the pipeline successfully, you must add two credentials in Jenkins (**Manage Jenkins** -> **Credentials** -> **Global**):

1. **Docker Hub Credentials (`docker-hub-credentials`)**:
   * **Kind**: Username with Password
   * **Username**: `mohammedmusa1`
   * **Password**: *[Your Docker Hub Password or Access Token]*
   * **ID**: `docker-hub-credentials`

2. **GitHub Personal Access Token (`github-pat-credentials`)**:
   * **Kind**: Username with Password
   * **Username**: `mohammedmusa1`
   * **Password**: *[Your GitHub PAT with repo scope]*
   * **ID**: `github-pat-credentials`

---

## 🐳 Step 7: Optimizing ArgoCD Sync Speed

By default, ArgoCD checks Git repositories every **3 minutes (180 seconds)**. In a low-resource dev environment, this delay feels slow. You can configure ArgoCD to sync **instantly** by setting up a GitHub Webhook or registering the Jenkins trigger.

To trigger ArgoCD to sync instantly when Git changes, you can configure ArgoCD to watch repository push events. Add a webhook in your GitHub repository settings pointing to:
`https://<your-ec2-ip-or-domain>/api/v1/webhook` (no authentication token is required for push webhooks in ArgoCD).

---

## 🛠️ Step 8: Troubleshooting & Diagnostics Runbook

Here are the safety commands to keep your `t3.micro` healthy and debug pipeline errors.

### 1. Host Out-of-Memory (OOM) Diagnostics
If Jenkins becomes unresponsive or the server freezes:
```bash
# Check if the kernel has killed Jenkins due to memory exhaustion
sudo dmesg -T | grep -i -E "oom|kill"

# Check live memory and swap usage
free -m

# Find top memory-consuming processes
ps aux --sort=-%mem | head -n 10
```

### 2. Force JVM Garbage Collection
If Jenkins is consuming too much RAM, you can force Java to run Garbage Collection and free up memory:
```bash
# Get Jenkins PID inside the container
docker exec jenkins jcmd 1 GC.run
```

### 3. Docker Socket Permissions Error
If the Jenkins pipeline fails with `Permission Denied` when running `docker build`:
```bash
# Verify the Docker socket group ID on the host
ls -la /var/run/docker.sock

# Give root execution inside the container (already resolved by running container with --user root)
# Alternatively, change host socket permissions (not recommended, but a quick fix):
sudo chmod 666 /var/run/docker.sock
```

### 4. Kubernetes Kubeconfig Permission issues
If Jenkins fails with `The connection to the server localhost:8080 was refused - did you specify the right host or port?`:
```bash
# Confirm Jenkins is looking at the correct file location:
docker exec jenkins ls -la /root/.kube/config

# If running in Bridge Mode, make sure you ran the sed command in Step 2:
docker exec -u 0 jenkins sh -c "sed -i 's/127.0.0.1/host.docker.internal/g' /root/.kube/config"
```

### 5. Disk Space Exhausted (Crucial on t3.micro)
Docker builds fill up local EBS volumes quickly. Run this command daily or place it in a cronjob to clean up unused builds:
```bash
# Clean up builder cache and dangling images
docker system prune -a --volumes -f
```
