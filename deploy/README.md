# Deploy the current site to a Contabo server
The bundled nginx and server scripts target `rstudio.uti1.com` and `/var/www/rstudio`.
1. Point the domain's DNS A record to your server and confirm it with `dig +short rstudio.uti1.com`.
2. From the project folder, set your SSH target (and optional key path):
   `SERVER=root@YOUR_SERVER SSH_KEY=/path/to/your/key bash deploy/deploy-contabo.sh`.
   `SSH_KEY` is optional when your normal SSH configuration already selects the key.
3. On the server:  sudo bash /tmp/deploy-on-server.sh
4. HTTPS:          sudo certbot --nginx -d rstudio.uti1.com
Assumes nginx on Debian or Ubuntu. If the server uses Apache or IIS instead, tell Claude and it will write that config.
