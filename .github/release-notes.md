## Novidades

- **Troque de conta sem perder o contexto:** perto do limite, o Orbit salva um registro de continuação de cada trabalho; quando a conta esgota, você continua em outra conta e o Claude retoma de onde parou.
- **Conta esgotada em destaque:** o topo do Orbit mostra "Conta esgotou · volta às HH:MM" e as sessões dela, cada uma com **Continuar em <conta>** e **Mudar conta**.
- **Layout mais limpo:** Sessões e trabalhos numa tela só, menos ícones e menos texto repetido.
- O instalador de uma linha sempre instala em **/Applications** no macOS.

Tudo o que mudou: [CHANGELOG.md](https://github.com/leandro5g/orbit/blob/main/CHANGELOG.md)

## Instalar com uma linha

**macOS / Linux** (Terminal):
```bash
curl -fsSL https://raw.githubusercontent.com/leandro5g/orbit/main/install.sh | sh
```

**Windows** (PowerShell):
```powershell
irm https://raw.githubusercontent.com/leandro5g/orbit/main/install.ps1 | iex
```

## Ou baixe o instalador

| Sistema | Arquivo |
| --- | --- |
| macOS · Apple Silicon (M1/M2/M3/M4) | `Orbit-*-mac-arm64.dmg` |
| macOS · Intel | `Orbit-*-mac-x64.dmg` |
| Windows 10/11 | `Orbit-*-win-x64.exe` |
| Linux | `Orbit-*-linux-x86_64.AppImage` |

**macOS, instalação manual:** o app ainda não é notarizado pela Apple. Na primeira abertura, arraste o Orbit para Aplicativos e rode
`xattr -dr com.apple.quarantine /Applications/Orbit.app` no Terminal (ou abra em Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim).

Requer o [Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado e com login feito.
