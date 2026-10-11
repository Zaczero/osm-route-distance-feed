{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShell {
  buildInputs = [
    pkgs.python312
  ];
  shellHook = ''
    uv sync --frozen --python ${pkgs.python312}/bin/python3.12 || exit "$?"
    source .venv/bin/activate
  '';
  passthru.python = pkgs.python312;
}
