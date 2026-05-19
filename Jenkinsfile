pipeline {
    agent any

    environment {
        IMAGE_NAME = "stockdevops-app"
        DOCKERHUB_USER = "zishan001"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Check Environment') {
            steps {
                sh 'docker --version'
                sh 'kubectl version --client'
                sh 'git --version'
            }
        }

        stage('Clone Repository') {
            steps {
                git branch: 'devops',
                url: 'https://github.com/mohammedmusa1/stock_Devops.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG .'
            }
        }

        stage('Tag Docker Image') {
            steps {
                sh 'docker tag $IMAGE_NAME:$IMAGE_TAG localhost:5000/$IMAGE_NAME:latest'
            }
        }

        stage('Push Docker Image') {
            steps {
                sh 'docker push localhost:5000/$IMAGE_NAME:latest'
            }
        }

        stage('Update GitOps Manifests') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
                        sh '''
                        # Configure Git
                        git config user.email "jenkins@stockdevops.com"
                        git config user.name "Jenkins GitOps"

                        # Update the Kustomize image tag for production
                        cd k8s/overlays/prod
                        
                        # Use kustomize or sed to update the image
                        sed -i "s|namespace: devops-prod|namespace: devops-prod\\nimages:\\n- name: localhost:5000/$IMAGE_NAME\\n  newTag: '$IMAGE_TAG'|" kustomization.yaml
                        
                        # Commit and push
                        cd ../../..
                        git add k8s/overlays/prod/kustomization.yaml
                        git commit -m "GitOps Update: Deploy build $IMAGE_TAG to production"
                        git push https://${GIT_USER}:${GIT_PASS}@github.com/mohammedmusa1/stock_Devops.git HEAD:devops
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline executed successfully!'
        }

        failure {
            echo 'Pipeline failed!'
        }
    }
}
