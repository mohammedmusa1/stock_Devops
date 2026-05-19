import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

cmd = ['ssh', '-n', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-i', 'd:/stockdevops/infrastructure/terraform/stockforge-key.pem', 'ubuntu@52.4.242.135', 'sudo kubectl get pods -A']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out, err = p.communicate()

if p.returncode == 0:
    print(out.decode('utf-8', errors='replace'))
else:
    print("ERR:", err.decode('utf-8', errors='replace').strip())
