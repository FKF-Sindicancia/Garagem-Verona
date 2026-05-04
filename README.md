# 🚗 Garagem — Tenda Verona

Sistema web para controle de entrada, permanência e saída de veículos em garagem condominial.

Foco em operação simples para portaria e gestão eficiente para administração.

---

## 🎯 Objetivo

Controlar o tempo de permanência de veículos na garagem, garantindo:

- Registro correto de entradas e saídas
- Identificação de veículos acima do tempo permitido
- Redução de erros operacionais da portaria
- Apoio à aplicação de multas conforme regulamento

---

## ⚙️ Funcionalidades

### 🧾 Registro de Entrada
- Cadastro rápido de veículo (placa, morador, apto, torre)
- Sugestão automática de dados ao digitar placa
- Seleção de marca e cor
- Atualização automática do cadastro da placa

---

### 📊 Painel (Dashboard)
- Total de veículos no dia
- Veículos atualmente no local
- Veículos excedidos
- Registros incompletos

#### Alertas operacionais:
- ⚠️ Quase excedendo (a partir de 45 min)
- 🚨 Excedidos (acima de 1h)
- 🧾 Dados incompletos

---

### 🚪 Registro de Saída
- Portaria registra saída com 1 clique
- Admin pode definir saída manual (casos de erro)
- Bloqueio de dupla entrada para mesma placa

---

### 🚗 Gestão de Placas
- Importação via CSV (Ucondo)
- Edição manual (admin)
- Atualização automática baseada no uso

---

### 💸 Controle de Multas
- Exibição automática após 1h15 de permanência
- Seleção de veículos para multa (admin)
- Geração automática de texto para envio de e-mail

---

## 🔐 Controle de Acesso

O sistema utiliza roles para controle de permissões:

| Perfil     | Permissões |
|------------|-----------|
| Admin      | Acesso total, edição, multas, importação |
| Portaria   | Registro de entrada/saída e visualização |
| View Only  | Apenas visualização |

---

## 🧠 Regras de Negócio

- ⏱ Tempo máximo permitido: **1 hora**
- ⏳ Tolerância: **15 minutos**
- ⚠️ Alerta de atenção: **45 minutos**
- 🚨 Multa: após **1h15**

---

## 🛠️ Tecnologias

- HTML + CSS + JavaScript (vanilla)
- Firebase:
  - Authentication
  - Firestore

- Deploy:
  - Vercel

---

## 🚀 Deploy

O projeto está hospedado via Vercel.

Para rodar localmente:

```bash
# apenas abrir o index.html