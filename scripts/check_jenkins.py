import subprocess
import json

cmd = ['ssh', '-n', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-i', 'd:/stockdevops/infrastructure/terraform/stockforge-key.pem', 'ubuntu@52.4.242.135', 'docker inspect jenkins']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out, err = p.communicate()

if p.returncode == 0:
    try:
        data = json.loads(out)
        print("STATUS:", data[0]['State']['Status'])
    except Exception as e:
        print("PARSE_ERROR:", str(e))
else:
    err_msg = err.decode().strip()
    if "No such object: jenkins" in err_msg:
        print("STATUS: NOT_CREATED")
    else:
        print("ERR:", err_msg)
