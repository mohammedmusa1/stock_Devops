pipeline {
    agent any

    stages {
        stage('Environment Test') {
            steps {
                sh 'echo TEST START'
                sh 'docker --version'
                sh 'kubectl version --client'
                sh 'git --version'
                sh 'echo TEST SUCCESS'
            }
        }
    }
}
