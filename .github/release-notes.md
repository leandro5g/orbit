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
