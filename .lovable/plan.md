

## Problemas Identificados

Voce relatou dois problemas:

### 1. GitHub nao sincroniza com o Lovable

O preview mostra "Preview has not been built yet". Isso acontece quando o codigo vindo do GitHub tem erros de build ou conflitos. 

**O que fazer (manual):**
- Na interface do Lovable, clique nos "..." ao lado do commit do GitHub e tente "Restore" para uma versao anterior que funcionava
- Ou: verifique se o commit do GitHub nao incluiu arquivos conflitantes (como o sistema PDV/e-commerce criado anteriormente que usa rotas e componentes diferentes do FilaLab)
- O Lovable precisa conseguir compilar o projeto para gerar o preview

**Isso nao e algo que eu possa corrigir via codigo** - e uma questao de sincronizacao entre o GitHub e a plataforma Lovable.

---

### 2. TV nao toca som/voz ao chamar motoboy

**Causa raiz identificada:** Politica de autoplay dos navegadores modernos.

Os navegadores bloqueiam reproducao de audio ate que o usuario interaja com a pagina (clique, toque). A pagina da TV carrega e fica em modo "passivo" sem interacao do usuario, entao quando o sistema tenta tocar o ringtone + TTS, o navegador bloqueia silenciosamente.

**Evidencia no codigo:**
- `TV.tsx` linha 537: `audioElement.play().catch(() => { cleanup(); resolve(); })` - o erro de autoplay e engolido silenciosamente
- O TTS via Web Speech API tambem pode ser bloqueado sem interacao

**Solucao proposta:**

Adicionar um overlay de "Ativar Audio" que aparece quando a pagina carrega, exigindo um clique do usuario para desbloquear o audio do navegador. Apos o clique, o overlay desaparece e o audio funciona normalmente.

---

## Plano de Implementacao

### Passo 1: Adicionar overlay de ativacao de audio na TV

No arquivo `src/pages/TV.tsx`:

- Criar um estado `audioUnlocked` (default `false`)
- Renderizar um overlay de tela cheia com botao "Ativar Audio da TV" quando `audioUnlocked === false`
- Ao clicar, reproduzir um audio silencioso curto para desbloquear o contexto de audio do navegador, e tambem chamar `speechSynthesis.speak()` com texto vazio para desbloquear o TTS
- Setar `audioUnlocked = true` e salvar no `sessionStorage` para nao pedir de novo na mesma sessao
- Condicionar `handleCallAnnouncement` a so rodar se `audioUnlocked === true`

### Passo 2: Melhorar tratamento de erros de audio

No `handleCallAnnouncement`:
- Adicionar log visivel (toast discreto) quando o audio falha, em vez de engolir o erro silenciosamente
- Isso ajuda a diagnosticar problemas futuros

### Passo 3: Garantir fallback de TTS funcione

Na funcao `playAudioSequence`:
- Apos o clique de desbloqueio, o Web Speech API deve funcionar normalmente
- Adicionar um pequeno delay antes do TTS para garantir que o contexto de audio esta ativo

---

## Detalhes Tecnicos

Arquivos modificados:
- `src/pages/TV.tsx` - overlay de ativacao + melhoria no tratamento de erros de audio

O overlay tera visual simples e profissional: icone de alto-falante, texto "Clique para ativar o audio da TV", botao grande centralizado. Desaparece apos o clique e nao volta durante a sessao.

