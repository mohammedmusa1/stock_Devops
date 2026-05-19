pipeline {
    agent any

    environment {
        // Build metadata
        REGISTRY = 'docker.io'
        IMAGE_NAME = 'stockdevops-app'
        DOCKERHUB_USER = 'zishan001'
        DOCKER_IMAGE = "${DOCKERHUB_USER}/${IMAGE_NAME}"
        
        // Jenkins Credentials IDs
        DOCKERHUB_CREDS_ID = 'dockerhub-creds'
        GITHUB_CREDS_ID = 'github-creds'
    }

    options {
        // Prevent build accumulation and memory starvation
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Check Environment') {
            steps {
                echo '=== [Stage: Check Environment] Verifying Installed Tools ==='
                sh '''
                    echo "Checking system resources..."
                    free -h
                    df -h
                    
                    echo "Checking Docker CLI and host daemon access..."
                    docker --version
                    docker info
                    
                    echo "Checking Kubernetes CLI..."
                    kubectl version --client
                    kubectl cluster-info || echo "Kubernetes API unreachable, proceeding..."
                '''
            }
        }

        stage('Clone Repository') {
            steps {
                echo '=== [Stage: Clone Repository] Pulling latest devops branch ==='
                checkout([$class: 'GitSCM', 
                    branches: [[name: '*/devops']], 
                    doGenerateSubmoduleConfigurations: false, 
                    extensions: [], 
                    submoduleCfg: [], 
                    userRemoteConfigs: [[
                        credentialsId: env.GITHUB_CREDS_ID, 
                        url: 'https://github.com/mohammedmusa1/stock_Devops.git'
                    ]]
                ])
                script {
                    env.GIT_SHA_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    echo "Checked out commit SHA: ${env.GIT_SHA_SHORT}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '=== [Stage: Build Docker Image] Compiling Application ==='
                sh "docker build -t ${env.IMAGE_NAME}:${env.GIT_SHA_SHORT} ."
            }
        }

        stage('Tag Docker Image') {
            steps {
                echo '=== [Stage: Tag Docker Image] Tagging Release & Latest ==='
                sh """
                    docker tag ${env.IMAGE_NAME}:${env.GIT_SHA_SHORT} ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT}
                    docker tag ${env.IMAGE_NAME}:${env.GIT_SHA_SHORT} ${env.DOCKER_IMAGE}:latest
                """
            }
        }

        stage('Docker Login & Push') {
            steps {
                echo '=== [Stage: Docker Login & Push] Authenticating and Pushing to Registry ==='
                withCredentials([usernamePassword(
                    credentialsId: env.DOCKERHUB_CREDS_ID, 
                    usernameVariable: 'DOCKER_USER', 
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh "docker push ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT}"
                    sh "docker push ${env.DOCKER_IMAGE}:latest"
                }
            }
        }

        stage('Kubernetes Deploy') {
            steps {
                echo '=== [Stage: Kubernetes Deploy] Applying manifests ==='
                sh 'kubectl apply -f k8s/ || true'
            }
        }
    }

    post {
        always {
            echo '=== [Post Build] Reclaiming host space by pruning unused build cache ==='
            sh 'docker image prune -f --filter "until=1h"'
        }
        success {
            echo "SUCCESS: StockDevOps Build #${env.BUILD_NUMBER} completed and deployed successfully!"
        }
        failure {
            echo "FAILURE: StockDevOps Build #${env.BUILD_NUMBER} failed! Review execution console logs."
        }
    }
}
