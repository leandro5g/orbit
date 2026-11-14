#!/bin/sh
# Instala (ou atualiza) o Orbit no macOS ou no Linux com a última versão do GitHub.
#   curl -fsSL https://raw.githubusercontent.com/leandro5g/orbit/main/install.sh | sh
#
# Variáveis opcionais: ORBIT_INSTALL_DIR (destino), ORBIT_NO_OPEN=1 (não abre ao terminar).
set -eu

REPO="leandro5g/orbit"
say() { printf '\033[35m✦\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "Precisa do curl instalado."

case "$(uname -m)" in
  arm64 | aarch64) ARCH=arm64 ;;
  x86_64 | amd64) ARCH=x64 ;;
  *) fail "Arquitetura não suportada: $(uname -m)" ;;
esac

case "$(uname -s)" in
  Darwin) PATTERN="-mac-$ARCH.zip" ;;
  Linux)
    [ "$ARCH" = x64 ] || fail "No Linux, por enquanto só há build x86_64."
    PATTERN="-linux-x86_64.AppImage"
    ;;
  *) fail "Sistema não suportado. No Windows, use o install.ps1 (veja o README)." ;;
esac

say "Procurando a última versão do Orbit…"
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
  grep -o '"browser_download_url": *"[^"]*'"$PATTERN"'"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
[ -n "$URL" ] || fail "Não achei o arquivo $PATTERN na última release."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
say "Baixando $(basename "$URL")…"
curl -fL --progress-bar "$URL" -o "$TMP/orbit"

if [ "$(uname -s)" = Darwin ]; then
  DEST="${ORBIT_INSTALL_DIR:-/Applications}"
  [ -w "$DEST" ] || DEST="$HOME/Applications"
  mkdir -p "$DEST"
  ditto -x -k "$TMP/orbit" "$TMP/app"
  if [ -d "$DEST/Orbit.app" ]; then
    say "Atualizando a versão instalada…"
    pkill -x Orbit 2>/dev/null || true
    rm -rf "$DEST/Orbit.app"
  fi
  mv "$TMP/app/Orbit.app" "$DEST/Orbit.app"
  # O app ainda não é notarizado pela Apple: sem isso o macOS bloqueia a abertura.
  xattr -dr com.apple.quarantine "$DEST/Orbit.app" 2>/dev/null || true
  say "Orbit instalado em $DEST/Orbit.app"
  [ "${ORBIT_NO_OPEN:-}" = 1 ] || open "$DEST/Orbit.app"
else
  DEST="${ORBIT_INSTALL_DIR:-$HOME/.local/bin}"
  mkdir -p "$DEST" "$HOME/.local/share/applications"
  mv "$TMP/orbit" "$DEST/Orbit.AppImage"
  chmod +x "$DEST/Orbit.AppImage"
  cat >"$HOME/.local/share/applications/orbit.desktop" <<EOF
[Desktop Entry]
Name=Orbit
Comment=Monitor de uso do Claude Code
Exec=$DEST/Orbit.AppImage
Terminal=false
Type=Application
Categories=Development;
EOF
  say "Orbit instalado em $DEST/Orbit.AppImage"
  [ "${ORBIT_NO_OPEN:-}" = 1 ] || (nohup "$DEST/Orbit.AppImage" >/dev/null 2>&1 &)
fi

say "Pronto! Procure o ✦ na barra de menus."
