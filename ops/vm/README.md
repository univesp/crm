# Homolog VM frontdoor

Este pacote documenta a topologia homolog em VM, com o Vue na frente e o Frappe como engine.

## Topologia

```text
https://homolog-crm.univesp.br/
  -> Nginx VM
      / e /login                  -> Vue build estatico
      /api/me                     -> SSO Gateway Node, porta 4000
      /api/sso/*                  -> SSO Gateway Node, porta 4000
      /api/method/*               -> Frappe web, porta 8000
      /api/resource/*             -> Frappe web, porta 8000
      /crm, /app, /desk           -> Frappe web, porta 8000
      /assets, /files             -> Frappe web, porta 8000
      /socket.io/*                -> Frappe socket.io, porta 9000
```

## Caminhos esperados na VM

```text
/var/crm/
├── sso-gateway/                  # Node.js SSO, porta 4000
├── frontend/                     # Next.js antigo, se ainda estiver em uso
├── univesp-frontend/             # Vue build publicado em dist/
└── frappe-bench/                 # Frappe CRM
```

O frontend Vue deve ser publicado em `/var/crm/univesp-frontend/dist`.
Esse caminho evita conflito com `/var/crm/frontend`, que no ambiente atual ainda
parece servir o Next.js antigo.

## Publicar o Vue na VM

Na VM:

```bash
cd /var/crm/univesp-frontend
npm ci
npm run build
```

Confirme que existe:

```bash
test -f /var/crm/univesp-frontend/dist/index.html
```

Se o codigo ainda nao estiver em `/var/crm/univesp-frontend`, clone ou copie a
pasta `univesp-frontend/` do repositorio para esse caminho antes do build.

## Aplicar o nginx

Copie `ops/vm/nginx/homolog-crm.univesp.br.conf` para:

```bash
sudo cp ops/vm/nginx/homolog-crm.univesp.br.conf /etc/nginx/sites-available/homolog-crm.univesp.br.conf
sudo ln -sfn /etc/nginx/sites-available/homolog-crm.univesp.br.conf /etc/nginx/sites-enabled/homolog-crm.univesp.br.conf
sudo nginx -t
sudo systemctl reload nginx
```

Tambem existe um script operacional com esses passos:

```bash
sudo bash ops/vm/scripts/apply-frontdoor.sh
```

Se a VM termina TLS diretamente no nginx, mantenha os certificados ja usados
pela homolog e apenas copie os blocos `location` deste arquivo para o server
HTTPS existente.

## Testes rapidos

Sem sessao, alguns endpoints podem retornar 401/403, mas devem cair no servico certo:

```bash
curl -I https://homolog-crm.univesp.br/
curl -I https://homolog-crm.univesp.br/login
curl -i https://homolog-crm.univesp.br/api/me
curl -i https://homolog-crm.univesp.br/api/method/frappe.auth.get_logged_user
curl -I https://homolog-crm.univesp.br/crm
```

O erro que nao pode mais aparecer para rota Frappe e:

```text
Cannot GET /api/method/...
```

Se aparecer, `/api/method/*` ainda esta caindo no Node/frontend em vez do Frappe.

Se `/` ou `/login` retornarem HTML com `__next_error__` ou assets `/_next/static`,
essas rotas ainda estao caindo no Next.js antigo em vez do Vue.
