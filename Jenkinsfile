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
                sh 'docker tag $IMAGE_NAME:$IMAGE_TAG $DOCKERHUB_USER/$IMAGE_NAME:latest'
            }
        }

        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                sh 'docker push $DOCKERHUB_USER/$IMAGE_NAME:latest'
            }
        }

        stage('Deploy To Kubernetes') {
            steps {
                sh 'kubectl apply -f k8s/'
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
