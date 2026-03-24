# Gamified Cert Trainer (MVP) – PWA Offline-first

Este projeto é um MVP funcional para estudar uma certificação com gamificação:
- Perguntas com feedback imediato (certo/errado) e explicação
- Pontos + streak + multiplicador
- Leaderboard pessoal (best score por modo)
- Modos: Practice, Exam, Weak Spots, Flash
- Progresso guardado localmente (IndexedDB)
- PWA com cache do dataset

## Requisitos
- Node.js 18+ (recomendado)
- npm (vem com Node)

## Instalar e correr localmente
1) Abrir um terminal na pasta do projeto
2) Instalar dependências:

```bash
npm install
```

3) Correr em modo dev:

```bash
npm run dev
```

Abrir: http://localhost:5173

> Nota: Service Workers / PWA funcionam em `localhost`.

## Build (produção)

```bash
npm run build
npm run preview
```

Abrir o endereço indicado no `preview`.

## Instalar no telemóvel como app
Para instalar uma PWA no telemóvel com offline a funcionar, precisas de servir o build em HTTPS.
Opções simples:
- GitHub Pages
- Netlify
- Vercel

Depois abre o link no telemóvel e escolhe **“Add to Home Screen / Adicionar ao ecrã principal”**.

## Atualizar perguntas
As perguntas são carregadas de `public/data/questions.json`.
Este ficheiro foi gerado automaticamente a partir do teu `full-exam-bank.md`.

Para atualizar:
- substitui o Markdown
- volta a gerar `questions.json` (podes reutilizar o script de parsing, ou pedir-me para o adaptar).

## Como testar rapidamente
- Home → Practice: seleciona 1 domínio e faz 5 perguntas
- Home → Exam: termina uma sessão e confirma que o leaderboard guarda o melhor score
- Faz algumas perguntas e falha algumas → Home → Weak Spots: deve começar a sugerir perguntas
- Home → Flash: percorre várias perguntas sem repetição

## Limitações do MVP (intencional)
- Dificuldade está com valor default (3). Podes editar `difficulty` no JSON.
- Exam mode usa pesos do cabeçalho quando disponíveis; caso contrário distribui uniformemente.
- Não há animações fancy de streak (podes adicionar depois).

Boa sorte e bons estudos! 🚀

## Regenerar questions.json a partir do Markdown
Se atualizares o teu .md, podes regenerar o JSON assim:

```bash
python3 tools/parse_md_to_json.py full-exam-bank.md public/data/questions.json
```

Depois reinicia o servidor (dev/preview).
