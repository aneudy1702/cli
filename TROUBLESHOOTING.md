# Test SSH connecion

```
ssh -i ~/.ssh/ocm_rsa ocm@localhost -o UserKnownHostsFile=/dev/null -p 2222
```

# Enable debug mode of SSH into `ocm-daemon`

Edit `src/class/daemon/SSH/Connection.js`. Add `debug: console.log,` into `client.connect()`.

Then run `npm run build`.
