# Changelog

Todas as mudanças relevantes do Orbit. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2026-11-16

### Novo
- **Troque de conta sem perder o contexto.** Cada sessão do Claude Code vira um trabalho. Nos 90% de uso
  (configurável), o Orbit salva um registro de continuação de cada trabalho aberto em
  `<repo>/.orbit/trabalhos/` (fora do git): objetivo, feito, falta, decisões, arquivos e próximo passo.
  Com os hooks instalados, o Claude reescreve esse registro no fim do turno.
- **Conta esgotada, em destaque.** Quando uma conta esgota (ou passa de 95%), o topo do popover mostra
  "Lab esgotou · volta às 17:40" e as sessões dela, cada uma com **Continuar em <conta>**. A conta com mais
  folga já vem sugerida, e **Mudar conta** troca na hora.
- **Continuar em outra conta** abre o Terminal na pasta do trabalho, já na conta escolhida, com o Claude
  lendo o registro. Opção de levar a conversa inteira (Ajustes).
- Notificação "trocar de conta?" ao chegar no limite de aviso.
- Ajustes: quando salvar o registro (80–95%) e quando perguntar sobre a troca (90–98%).

### Mudou
- **Layout mais limpo.** A tela "Trabalhos" foi unida a **Sessões**: sessões agrupadas por conta, com o uso
  de 5h e da semana no topo de cada grupo, e os trabalhos parados numa seção própria.
- Cabeçalho com menos ícones; um ponto amarelo avisa quando há trabalho parado.
- Limites com o horário de renovação na mesma linha; previsão em uma linha só, escondida quando a conta já
  esgotou; aviso de "uso lido há X" só quando a leitura está velha.
- A lista de contas diz "esgotou" em vez de "100%".
- O instalador de uma linha sempre instala em `/Applications` no macOS e pede a senha de administrador
  quando precisa (antes caía em `~/Applications` sem avisar).
- O hook do Orbit (`~/.orbit/hook.sh`) é atualizado sozinho quando muda de versão.

## [0.1.1] - 2026-11-14

### Mudou
- Instalação em uma linha para macOS, Linux (`install.sh`) e Windows (`install.ps1`).
- README em inglês e português com demo animada, FAQ e roadmap; vídeo de demonstração.
- Release: testes do instalador rodam só em macOS e Linux.

## [0.1.0] - 2026-11-14

### Novo
- Monitor de uso do Claude Code na barra de menus: limites de 5h e semanal por conta, contagem até o
  reset, previsão de esgotamento, sessões ativas, alterações de código e alertas nativos.

[0.2.0]: https://github.com/leandro5g/orbit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/leandro5g/orbit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/leandro5g/orbit/releases/tag/v0.1.0
