{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShell {
  packages = [ pkgs.bun ];
  shellHook = ''
    bun install --frozen-lockfile
  '';
}
