# LIBELLUZ — Prompt de contexto para iniciar o desenvolvimento

> **Para o Claude que vai ler isto:** este arquivo resume uma longa conversa de descoberta com o Lucas (o dono do projeto) que aconteceu num projeto errado (uma pasta de vídeo Remotion). Agora o projeto certo é esta pasta: `C:\Users\lucas\Projetos\libelluz`. Leia tudo, olhe as imagens em `_contexto/imagens/`, salve as decisões principais na sua memória do projeto e **siga a seção "Primeiros passos"** no final. Converse em **português (pt-BR)**. O Lucas prefere aprovar visualmente por etapas (mostre telas antes de construir tudo) e gosta de ritmo rápido nas iterações intermediárias.

---

## 1. O que é

**Libelluz** é um app de estudos para o **ENEM**, **totalmente gamificado**, para o Lucas e um pequeno grupo de amigos (uso privado, não é produto público). A ideia central: *você não "cumpre um cronograma"; você evolui enquanto constrói sua preparação rumo aos 160+ acertos.* Mistura estudo, desempenho, hábitos e uma camada social — inspirado em **Duolingo** (gamificação, sequência, notificações insistentes), **Strava** (feed de atividades, compartilhamento), **Spotify Wrapped** (retrospectiva) e na **Plataforma Assaad** (dashboard, mapa de progresso, cronograma em blocos).

- Funciona na **web** e no **celular** (PWA + **APK Android** — prioridade máxima; quase ninguém do grupo usa iPhone).
- Endereço: **`libelluz.vercel.app`**.
- Único admin: **o Lucas**.
- Sem anti-trapaça de XP: são amigos, ninguém vai farmar.
- Futuro: integração com **Pluteuz** (app de leitura do Lucas, **ainda não existe** — não implementar agora; ler livro dá XP, livro da lista ENEM dá XP em dobro).

## 2. Identidade visual

- **Seguir o Figma** do Lucas (imagens em `_contexto/imagens/figma/`). Ele vai mandar mais telas/arquivos do Figma depois e o design será ajustado/substituído aos poucos. Até lá: azul principal do Figma, cards brancos arredondados com sombra leve, visual limpo.
- **Modo claro e escuro** desde o início. App **muito personalizável**.
- **Logo = cairn** (pedrinhas empilhadas). Conceito: **🪨 Pedras = estudo** (cada sessão de foco é uma pedra; a pilha cresce com o nível; cairns marcam a trilha da Jornada) e **🔥 Foguinho = constância e autocuidado**.
- **Mascote = o Foguinho** (bichinho virtual, ver §7). O personagem roxo de óculos escuros do Figma É o foguinho. As 5 chamas da imagem `04-...` são referência de estilo — a **arte final precisa ser original**.
- Símbolo de sequência estilo TikTok: o fogo **vai apagando** conforme o dia acaba sem estudo.

## 3. Stack e infraestrutura (aprovada)

| Peça | Escolha |
|---|---|
| Framework | **Next.js (App Router) + TypeScript** |
| UI | **Tailwind + shadcn/ui**, Framer Motion (animações), Recharts (gráficos) |
| Banco | **Neon (Postgres)** + **Drizzle ORM** |
| Auth | **Auth.js** com **Google** e **e-mail + senha**; cadastro exige **código de convite** |
| Hospedagem | **Vercel** (deploy automático; preview por branch) |
| Repositório | **GitHub**, repo novo `libelluz` |
| Arquivos | **Cloudflare R2** (10 GB grátis, sem custo de download). Upload de PDF/áudio/vídeo curto (~500 MB por arquivo, quota por pessoa) + links (YouTube/Drive) para aulas longas |
| Mobile | **PWA** instalável + **APK Android via Capacitor**, baixado direto de um link no site (sideload, sem Play Store). O APK permite recursos nativos: UsageStats + overlay para o sistema de tokens/bloqueio de apps, notificações confiáveis |
| Notificações | Web Push (VAPID) + push nativo no APK; agendamento via cron (atenção: cron da Vercel Hobby é limitado — avaliar QStash/GitHub Actions) |

O Lucas **já tem contas e está logado** neste PC em GitHub, Vercel e Neon. Você não cria contas nem digita senhas: guie-o quando precisar (ex.: credenciais OAuth no Google Cloud, variáveis de ambiente). Admin definido por variável de ambiente (`ADMIN_EMAIL`) — pergunte ao Lucas qual e-mail usar.

**Fluxo de trabalho:** cada funcionalidade numa branch → PR → link de preview da Vercel → Lucas testa no PC/celular e aprova visualmente → merge em `main` → produção.

## 4. Navegação

- **Desktop:** menu superior (Início, Aulas, Questões/Simulados, Redações, Cronograma, Mapa, Grupos) + foguinho/sequência, tema claro/escuro, sino. Dentro de Início, abas **Hoje / Semana / Jornada / Ranking & Conquistas**. (No rascunho havia também uma barra lateral e aba "Semana" duplicada — remover; três navegações na mesma tela é demais.)
- **Mobile:** cabeçalho azul (Olá, Lucas · 🔥 sequência · 🔔) + barra inferior: **Início · Aulas · [FOCO — botão central grande] · Grupos · Mais** (no wireframe estava "Questões"; sugeri trocar por Aulas — confirmar com o Lucas). O resto (Questões, Simulados, Redações, Cronograma, Mapa, Perfil, Config) fica em "Mais".
- **Timer persistente:** com uma sessão de foco rodando, o botão Foco vira um anel com o tempo (`32:14`); no desktop, um pill de tempo no topo (como na Assaad). Navegar pelo app não interrompe o timer, e ele sobrevive a recarregar/fechar (guardar timestamps no servidor).

## 5. Dashboard (aba Hoje)

Baseado em `01-dashboard-desktop.png` e `02-home-mobile-wireframe.png`:
- **Cabeçalho/Card de progresso:** avatar, "Olá, Lucas", nível + título, barra de XP (ex.: 63/130), dias estudados, **Modo de estudo**, botão **Modo Foco** (botão vermelho).
- **Hoje:** "▶ Continuar de onde parei" (abre o foco já com o tópico), tarefas do dia (vêm dos blocos do cronograma), revisões do dia, metas (aulas, questões, horas de foco).
- **Card do foguinho/sequência:** o próprio mascote + "10 dias seguidos" + bolinhas da semana (D S T Q Q S S).
- **Faixa de hábitos** (secundária, agrupada): água do dia (copos), humor do dia + diário, leitura (ex.: 30 min), exercício físico.
- **Estatísticas:** horas da semana (barras), taxa de acerto, horas por matéria, recorde histórico. Trocar o "Você está entre os 45%" (percentil não faz sentido com poucos amigos) por comparação no grupo ("2º no grupo esta semana") ou consigo mesmo ("+18% vs semana passada").

**Modo de estudo** = status **automático** calculado pela constância dos **últimos 14 dias** (a pessoa não escolhe): **Baixo** (pouco estudo, sem frequência) · **Regular** (constante) · **Avançado** (superando metas). Afeta o tom das notificações (insistente no Baixo, comemorativo no Avançado), dá bônus de XP no Avançado e fica no histórico.

## 6. XP e níveis

Regras confirmadas:
- **Entrar no app** já dá um pouco de XP (login diário).
- Questão **certa = 3 XP**, **errada = 1 XP**.
- XP necessário por nível **aumenta** a cada nível.
- **De 10 a 15 níveis**, com títulos (o Lucas gostou de Novato → Iniciante → Construtor → Atacante → Elite 160+, mas quer **mais nomes**).
- **Muitas e muitas formas de ganhar XP**, com várias nuances. Hábitos (água, humor etc.) alimentam o **calor do foguinho**, não o XP de estudo.

**Proposta inicial a validar com o Lucas** (refine e apresente como tabela):

Títulos (15): 1 Novato · 2 Aprendiz · 3 Iniciante · 4 Explorador · 5 Estudante · 6 Dedicado · 7 Construtor · 8 Persistente · 9 Estrategista · 10 Atacante · 11 Veterano · 12 Especialista · 13 Mestre · 14 Elite · 15 Lenda 160+.
Curva sugerida (XP total acumulado): 0 · 300 · 800 · 1.600 · 2.800 · 4.500 · 6.800 · 9.800 · 13.600 · 18.300 · 24.000 · 31.000 · 39.500 · 49.500 · 61.000 (nível 15 ≈ um ano de estudo forte).

Fontes de XP (rascunho): login diário +5 · cada 25 min de foco +10 · marcos de foco no dia 1h / 2h / 5h (bônus; 5h = multiplicador do dia) · questão certa +3 / errada +1 · 10 e 50 questões no dia (bônus) · tarefa concluída +10 · todas as tarefas do dia +30 · bloco do cronograma cumprido · revisão concluída +15 (bônus se feita no dia certo) · habilidade marcada como Domínio +20 · tópico 100% +50 · fase concluída +500 · redação +50 (+bônus por faixa de nota) · parte de simulado +40 · simulado completo +250 · ENEM antigo completo +300 · novo recorde de acertos +100 · sessão de flashcards/Anki registrada · cadastrar questão no banco (pequeno) · compartilhar questão com o grupo · missão do grupo +100 · meta semanal +100 e bônus ao superar · sequência de dias (bônus crescente) · modo Avançado (+10%) · **ênfase em Natureza e Matemática** (ex.: +20% de XP nessas áreas, pedido do Lucas) · leitura via Pluteuz (futuro: XP; livro da lista ENEM = dobro).

Referência: a Assaad usa erro 1 / acerto 2, aula 10–20, bônus a cada 1h/2h de foco, multiplicador em 5h, bônus em 10/25/50 questões, com notificação bonita de "+XP" e "Parabéns, você avançou de nível".

## 7. Foguinho (bichinho virtual) e sequência

- **Sequência (streak):** um dia conta se teve **pelo menos um pouco de foco** (qualquer sessão de foco). **O dia vira à meia-noite.**
- **Lenha guardada 🪵** (congelador de sequência, estilo "bloqueio de ofensiva" do Duolingo): ganha 1 a cada 7 dias seguidos (máx. 2); se um dia passar em branco, a lenha queima no lugar. **Descanso planejado** no cronograma (descanso semanal com lazer) **não quebra** a sequência nem gasta lenha.
- **Foguinho:** bichinho com **nome editável** (lápis). Ganha **calor** 🌡️ (moeda separada do XP) com tarefinhas diárias: beber a meta de água, meta de leitura, concluir as tarefas do dia, registrar o humor, estudar (mais horas = mais calor), pausa de respiração, exercício etc.
- **Evolução em 5 estágios pela temperatura da chama:** 🔴 Faísca → 🟡 Chama → 🟣 Labareda → 🩵 Fogo-fátuo → 🔵 Chama Azul. Evolui **ao completar tarefas** (barra de calor cheia), e **cada evolução é mais difícil** que a anterior (como referência de ritmo para quem é constante: ~2 semanas, ~2 meses, ~5 meses, ~9 meses). Estágios futuros aparecem como silhueta "?" (setas na tela "Animal de Estimação").
- **Perder a sequência:** o foguinho fica triste/apagado **e perde parte do calor** (sem regredir de estágio — confirmar o detalhe).
- Humor reflete o dia: feliz/brilhando quando estudou; vai apagando/sonolento no fim do dia sem estudo.
- Acessórios desbloqueáveis (os óculos escuros podem ser prêmio da 1ª semana; boné, fone, coroa…). Aparece ao lado do nome nos grupos e é a **voz das notificações**.

## 8. Estrutura de estudos: Aulas e Mapa

- **Uma árvore só, duas visões:** **Aulas** = organizar e estudar; **Mapa** = progresso na mesma estrutura.
- Hierarquia: **Área → Disciplina → Tópico/Subdisciplina → Habilidade** (ex.: Natureza → Biologia → Citologia → "Diferenças entre célula procarionte e eucarionte"). Cada pessoa pode criar/editar a sua (ex.: Matemática → Básica I, Básica II…). Áreas: Linguagens, Humanas, Natureza, Matemática (+ Redação).
- **Árvore inicial pré-carregada**, editável, baseada no **Mapa de Progresso Competitivo** (`_contexto/referencias/mapa-progresso-competitivo.txt` / `.pdf`) — e o Lucas pediu para **adicionar ainda mais conteúdo** além do mapa (complete com tópicos do ENEM que faltarem). Cada habilidade tem **etiqueta de relevância** (Obrigatório / Recomendado / Alta-Média-Baixa incidência × Baixa-Média-Alta complexidade) e uma **fase**: **Nivelamento (Novato) → Básico I (Iniciante) → Básico II → Construção → Ataque**. As fases atravessam todas as matérias. Mapa deve ter filtro "por disciplina" e "por fase" (como Disciplinas × Ciclos da Assaad).
- **Teoria / Prática / Domínio** por habilidade: sessões de "Teoria" avançam Teoria; "Questões" avançam Prática; revisão com bom acerto aproxima de Domínio. O app **sugere** marcar ("3 sessões de questões em Porcentagem com 85% — marcar Domínio?").
- Mapa mostra % de acerto, horas, o que está sem revisão ("🔴 Probabilidade há 17 dias sem revisão", "🟡 errando mais em combinatória", "🟢 Funções evoluindo").
- **Aulas:** sub-abas **Estrutura** e **Materiais**. Aulas são pessoais (só a pessoa vê): vídeo enviado ou link. **Materiais** (PDFs, livros, apostilas) ficam numa sub-aba própria, com etiqueta de matéria para filtrar.
- **Data-alvo:** cada pessoa escolhe a data/ano do ENEM que vai fazer; contagens regressivas e revisões se ajustam.

## 9. Modo Foco

Imagem `03-foco-e-pausas-bem-estar.png`. Três momentos:
1. **Configurar:** escolher **matéria → submatéria/tópico** (da árvore da pessoa; recentes + sugestão do cronograma no topo; revisão do dia pré-selecionada) · **tipo de estudo**: Teoria · Questões · Revisão · Videoaula · Flashcards (· Redação) · **método**: **Cronometrado / Pomodoro / Livre (∞)** · slider + atalhos 30 min, 1h, 1h30, 2h · "Começar Estudo".
2. **Durante:** anel de progresso grande, matéria e tipo, pausar/parar; barra discreta de atalhos: 💧 água · 🌬️ respiração (respiração quadrada 4-4-4-4) · 🧘 alongar · 🎧 ruído branco · 📝 nota rápida · 🎙️ nota em áudio · ☑️ checklist · 📌 insight. No Pomodoro a pausa abre automaticamente uma **tela de bem-estar** (respirar / beber água / alongar — referência das telas com personagem fofo; no Libelluz o personagem pode ser uma pedrinha do cairn ou o foguinho). No Livre, sugerir pausa a cada ~50 min. **Tempo pausado é descartado.**
3. **Resumo:** tempo, +XP, "uma pedra nova no seu cairn" (animação), e se o tipo foi Questões/Revisão: **feitas** e **acertos** (erros = feitas − acertos), humor da sessão, notas salvas. As questões são feitas **fora do app** (livro, PDF, sites) e só os números são informados aqui.

## 10. Questões

- **Não há um banco central para responder no app.** Cada pessoa tem seu **banco individual**: cadastra enunciado, imagens e alternativas; mantém privado ou **compartilha com o grupo**. O admin pode publicar questões globais (raramente).
- A contagem de questões feitas vem do **Foco** (§9).
- (Ideia a confirmar: poder responder as próprias questões depois como revisão.)

## 11. Simulados e ENEMs antigos (novo — pedido no fim da conversa)

- Simulados são **PDFs**. Na área de Simulados a pessoa **cadastra novos simulados** (nome, fonte, data, PDF enviado ou link).
- Cada simulado tem **5 partes**: **Ciências da Natureza, Matemática, Linguagens, Ciências Humanas e Redação**. Dá para **concluir o simulado inteiro de uma vez ou só uma parte** (ex.: só Natureza), cada parte com data, acertos (de 45), tempo gasto; Redação com nota (e C1–C5 opcional).
- Também dá para registrar **ENEMs antigos de fato** (lista pré-cadastrada: ENEM 2009/2010 a 2025, incluindo PPL e digital — ver a tabela no fim do Mapa de Progresso), com a mesma estrutura de 5 partes.
- Alimenta a tela **"Rumo aos 160+"**: linha do tempo dos totais (de 180) e por área, recorde, evolução.

## 12. Cronograma

Baseado na análise do vídeo da Assaad (`_contexto/referencias/video-tour-plataforma-assaad-transcricao.txt`, trecho 36:00–43:00). Aprovado:
- **Sem horários.** A semana é planejada em **blocos de N horas por dia** (colunas Seg–Dom), cada bloco = tópico da árvore + duração. Fases em ordem, mas **dentro da fase a ordem é livre**.
- Blocos do dia viram as **Tarefas do dia** do dashboard; tocar abre o Foco já configurado.
- **O Foco preenche o bloco sozinho** (sessões naquele tópico somam horas; bateu, concluiu). **Cumprir ≠ dominar:** domínio é marcado no Mapa.
- Bloco não feito vai para **pendentes**/próximo dia livre, **sem vermelho, sem culpa** (o app não força; mexe com a dopamina).
- Configuração: dias de estudo, dias sem estudo, **descanso semanal** (com sugestão de lazer), horas disponíveis, data-alvo.
- Botão **"Sugerir minha semana"**: distribui blocos pela ordem das fases, horas disponíveis, descansos e revisões pendentes; a pessoa ajusta.
- **Tempo estimado por tópico:** começa digitado e o app corrige pelo histórico da pessoa.
- **Revisões automáticas** como blocos no cronograma, com base científica: efeito de espaçamento (Cepeda et al. 2006/2008), prática de recuperação (Roediger & Karpicke 2006 — revisar fazendo questões/flashcards, não relendo), intercalação (Rohrer & Taylor 2007). Regra: após o 1º estudo, revisões em **1 → 7 → 30 dias**; acerto < 60% encurta, > 85% estica (lógica tipo Anki simplificada); intervalos encolhem perto da data-alvo.
- Concluir uma fase inteira = marco (cairn completo na trilha da Jornada + conquista).
- Incentivo a fazer flashcards no **Anki** e a dar ênfase em **Natureza e Matemática**.

## 13. Redação

- **Banco de temas** cadastrado pela pessoa (título, eixo — educação, saúde, tecnologia, meio ambiente, sociedade, economia, cultura —, link/fonte, anotações de repertório).
- **Ritmo:** dia fixo (ex.: 1 por semana, aos sábados → sorteia tema no sábado) **ou** **tema da semana** (sorteado na segunda, faz quando tiver tempo).
- Sorteio prioriza eixos pouco praticados. **Aceitar ou Passar, sem limite**; tema passado **volta ao estoque** e reaparece depois. O app nota eixos evitados ("você passou 4 temas de economia").
- **Registro:** foto/PDF/texto, nota total + **C1–C5**, etiquetas de erro (tangenciou o tema, proposta de intervenção incompleta, coesão…), comentários da correção. Gráfico de evolução **por competência**.

## 14. Grupos (proposta aprovada em linhas gerais)

- **Feed** (Strava): cada sessão de foco vira card automático ("Nico estudou 1h20 de Química · 32 questões · 81%"); reações 🔥👏💪 e comentários; posts manuais (foto da mesa, conquista).
- **Estudando agora** (Discord/Forest): quem está em foco neste momento. Depois: estudar junto no mesmo timer.
- **Ranking semanal** (horas, XP, questões; zera na segunda) — em vez de ligas.
- **Missões** cooperativas (grupo ou dupla, estilo "missão dos amigos" do Duolingo).
- **Cutucar 👉** amigo que não estudou hoje (vira notificação).
- **Banco de questões do grupo.**
- **Privacidade:** cada pessoa escolhe nas **configurações** o que aparece para o grupo (ex.: esconder taxa de acerto).
- MVP dos grupos: feed + estudando agora + ranking + cutucar.

## 15. Notificações (estilo Duolingo, voz do foguinho)

Insistentes e personalizadas, tom ajustado pelo Modo de estudo. Exemplos: "🔥 17 dias de foguinho. Não vai deixar apagar por 25 minutinhos, né?" · "👀 O Nico estudou 2h hoje. Você estudou… vamos mudar isso?" · "🧠 Probabilidade está há 12 dias sem revisão. Ela tá com ciúmes da Biologia." · "💧 Pausa estratégica: bebe uma água aí." · "🎯 Faltam 47 dias pro ENEM." · "🛡️ Sua lenha protegeu o foguinho ontem. Hoje é com você!" · "🥶 Brasa tá ficando com frio. Bora estudar?"

## 16. Outras funcionalidades da lista original

- **Hábitos** (camada secundária, simples): água diária, exercício em certos dias, humor do dia + **diário**, leitura, sono.
- **Checklists**, metas e tarefas do dia (agenda pessoal: digita, enter, vira checkbox).
- **Conquistas** com estrelas/níveis e barra de progresso (Em chamas, Maratonista 10h/50h/100h, Matemático 1.000 questões, Naturalista, Escritor 20 redações, 150+… algumas **secretas**).
- **Estatísticas abundantes:** horas por matéria, linha do tempo, desempenho, questões respondidas, rumo aos 160+.
- **Compartilhar no Instagram** (estilo Strava): imagem gerada do estudo do dia (Web Share API / share nativo no APK); **retrospectiva mensal** (tipo "máquina do tempo" do Spotify) e **anual**.
- **Modo Disciplina / tokens:** o usuário define apps (Instagram, TikTok…), recebe N tokens/dia de X minutos; ao abrir um app bloqueado aparece "Você está prestes a gastar 1 token. Restam 2. É realmente necessário? [ENTRAR] [VOLTAR]". Ligado ao XP (estudou → ganhou XP → ganhou tokens). **Só funciona no APK Android** (UsageStats + overlay / AccessibilityService). Bloqueio de notificações também.
- **Usuário admin** (só o Lucas): cadastrar questões globais, gerar convites, editar a árvore padrão.

## 17. Fases de produção (reordenadas: APK é prioridade máxima)

- **Fase 1 — base usável:** setup (repo, Next, Neon, Drizzle, Auth Google + e-mail/senha + convite, Vercel), design tokens claro/escuro seguindo o Figma, layout responsivo (top nav desktop / bottom nav com Foco no mobile), PWA instalável · árvore de estudos (com template pré-carregado) · **Foco completo** com timer persistente · XP, níveis, sequência + lenha · dashboard Hoje · tarefas do dia · hábitos (água, humor + diário, leitura) · estatísticas básicas · **APK Android via Capacitor já no fim da Fase 1** (casca do app + link de download).
- **Fase 2 — cérebro:** cronograma em blocos + revisões automáticas · Mapa T/P/D · **simulados e ENEMs antigos** · redação · banco de questões · materiais/upload (R2).
- **Fase 3 — social e diversão:** grupos · notificações push · foguinho completo (calor, evolução, arte) · conquistas · **tokens/bloqueio de apps no APK** (puxar para antes se o Lucas quiser).
- **Fase 4 — extra:** compartilhar no Instagram · retrospectivas · integração Pluteuz.

## 18. Pendências / perguntas ainda abertas

1. E-mail do admin (`ADMIN_EMAIL`).
2. Barra inferior mobile: "Aulas" no lugar de "Questões"?
3. Validar a tabela completa de XP e os 15 títulos de nível (§6).
4. Perder sequência: quanto de calor o foguinho perde (ex.: 20% do progresso do estágio atual, sem regredir)?
5. Poder responder as próprias questões cadastradas como revisão?
6. Ambiente Android para gerar o APK: verificar se há JDK + Android SDK/Android Studio neste PC (ou gerar o APK via GitHub Actions).
7. Arquivos do Figma (o Lucas vai mandar mais telas/arquivo depois).

## 19. Arquivos de contexto nesta pasta

- `_contexto/imagens/figma/` — telas do Lucas:
  - `01-dashboard-desktop.png` — rascunho do dashboard desktop (nav, cabeçalho com XP/dias/modo/Modo Foco, abas, cards XP/To-do/Metas/Streak/Água/Humor/Leitura, estatísticas Recorde/Comparativo/Exercício)
  - `02-home-mobile-wireframe.png` — home mobile (cabeçalho azul, 3 cards, Estatísticas, bottom nav com Foco central)
  - `03-foco-e-pausas-bem-estar.png` — tela do Foco (play, modos Cronometrado/Pomodoro/Livre, slider, presets, Começar Estudo) + inspiração de telas de pausa (respirar, mover o corpo, beber água)
  - `04-foguinho-streak-pet-e-mascotes.png` — card de streak, tela "Animal de Estimação" do foguinho, e as 5 chamas de referência
- `_contexto/imagens/inspiracao/` — Duolingo (ofensiva, missão dos amigos, ligas, conquistas, trilha, notificações) e Plataforma Assaad (home e dashboard semana). **Não versionar** (está no `.gitignore`).
- `_contexto/referencias/` — **Mapa de Progresso Competitivo** (PDF de 80 páginas + texto extraído: checklist simplificado por matéria, checklist intensivo por fase com habilidades/relevância/Teoria-Prática-Domínio, tabelas de provas antigas e simulados) e **transcrição do vídeo** "Tour ultra detalhado pela Plataforma Assaad" (https://www.youtube.com/watch?v=3t8UoNp0vLs). Conteúdo de terceiros, uso pessoal — **não versionar**.

## 20. Primeiros passos para você (Claude)

1. Leia este arquivo inteiro, **veja as 4 imagens do Figma** e passe os olhos nas inspirações e nas referências.
2. Salve na sua memória do projeto as decisões principais e a preferência de trabalho do Lucas (aprovação visual por etapas; rapidez nas iterações intermediárias).
3. Confirme com o Lucas, em poucas linhas, que entendeu, e faça **só as perguntas pendentes que bloqueiam a Fase 1** (§18).
4. Inicialize o projeto nesta pasta (Next.js + TS + Tailwind + shadcn), `git init`, crie o repo `libelluz` no GitHub (`gh` já está logado), conecte a Vercel e o Neon (guie o Lucas onde for preciso).
5. Comece pela **base visual**: layout responsivo + dashboard Hoje + tela do Foco, com dados de exemplo, e mande o link de preview para aprovação **antes** de implementar a lógica completa.
