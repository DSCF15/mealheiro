# Mealheiro

Aplicação web (PWA) de finanças pessoais em português de Portugal, pensada para telemóvel. Funciona sem internet e não tem servidor nem contas: os dados ficam apenas no teu dispositivo.

## Funcionalidades

- **Início:** saldo disponível, entradas e saídas do mês, gráfico de gastos por categoria e próximos pagamentos.
- **Movimentos:** despesas e receitas com valor, data, descrição, categoria e método de pagamento. Filtros por mês, categoria e tipo, e pesquisa.
- **Categorias:** criar, editar e apagar, com ícone e cor.
- **Orçamento:** rendimento mensal distribuído por potes, em percentagem ou valor fixo (por omissão 50/30/20), com barras de progresso.
- **Pagamentos mensais:** contas recorrentes com dia de vencimento. Marcar como pago desconta no saldo e cria o movimento.
- **Dívidas:** separadores "Devem-me" e "Devo", com amortizações parciais até à liquidação.
- **Poupança:** cofres com valor alvo e botões para adicionar ou retirar dinheiro do saldo.
- **Dados:** backup e restauro em JSON, exportação para Excel (.xlsx) e CSV.

## Como o saldo é calculado

`Saldo = saldo inicial + receitas − despesas ± transferências`

Depósitos em cofres e movimentos de dívidas alteram o saldo, mas são transferências: não contam como receitas nem despesas do mês.

## Executar localmente

Não há dependências nem passo de compilação.

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`.

## Publicar

O workflow em `.github/workflows/pages.yml` publica a app no GitHub Pages a cada push para `main`. Em **Settings → Pages → Source**, escolhe **GitHub Actions**. O GitHub Pages em repositórios privados requer um plano pago.

Ao publicar alterações, aumenta `VERSION` em `sw.js` para os dispositivos receberem a nova versão.

## Instalar no telemóvel

A instalação requer HTTPS, que o GitHub Pages já fornece.

- **Android (Chrome):** menu ⋮ → *Instalar aplicação*.
- **iPhone (Safari):** Partilhar → *Adicionar ao ecrã principal*.

## Privacidade e cópias de segurança

Os dados ficam no `localStorage` do browser, sem encriptação. Limpar os dados do browser ou desinstalar a app apaga-os, por isso faz backups regulares em **Definições → Backup completo**.
