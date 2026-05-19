resource "aws_instance" "app" {
  ami                  = var.ami_id
  instance_type        = var.instance_type
  subnet_id            = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  key_name             = var.key_name
  iam_instance_profile = var.iam_instance_profile
  user_data            = var.user_data

  root_block_device {
    volume_size           = 50
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-instance"
  }
}

resource "aws_eip" "app_eip" {
  instance = aws_instance.app.id
  domain   = "vpc"
  
  tags = {
    Name = "${var.project_name}-eip"
  }
}
