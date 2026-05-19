pipeline {
    agent any

    environment {
        IMAGE_NAME = "stockdevops-app"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        stage('Check Environment') {
            steps {
                sh 'echo "===== Environment Check ====="'
                sh 'git --version'
                sh 'kubectl version --client || true'
                sh 'echo "Jenkins Connected Successfully"'
            }
        }

        stage('Clone Repository') {
            steps {
                git branch: 'devops',
                url: 'https://github.com/mohammedmusa1/stock_Devops.git'
            }
        }

        stage('Verify Kubernetes Cluster') {
            steps {
                sh 'kubectl get nodes || true'
                sh 'kubectl get pods -A || true'
            }
        }

        stage('Update GitOps Manifests') {
            steps {
                script {
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'github-creds',
                            usernameVariable: 'GIT_USER',
                            passwordVariable: 'GIT_PASS'
                        )
                    ]) {

                        sh '''
                        echo "===== Configuring Git ====="

                        git config user.email "jenkins@stockdevops.com"
                        git config user.name "Jenkins GitOps"

                        echo "===== Updating Deployment ====="

                        sed -i 's/replicas: [0-9]\\+/replicas: 5/g' k8s/deployment.yaml || true

                        echo "===== Git Status ====="

                        git status

                        git add .

                        git commit -m "GitOps Update Build ${BUILD_NUMBER}" || true

                        echo "===== Pushing Changes ====="

                        git push https://${GIT_USER}:${GIT_PASS}@github.com/mohammedmusa1/stock_Devops.git HEAD:devops
                        '''
                    }
                }
            }
        }

        stage('Verify ArgoCD Sync') {
            steps {
                sh 'kubectl get applications -n argocd || true'
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo 'Pipeline executed successfully!'
            echo 'GitOps flow completed!'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'Pipeline failed!'
            echo '======================================'
        }
    }
}
