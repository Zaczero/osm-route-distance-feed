{
  pkgs ? import <nixpkgs> { },
}:
let
  shell = import ./shell.nix { inherit pkgs; };
  inherit (shell) python;
  pythonPackages = pkgs.runCommand "route-distance-python-packages" { } ''
    mkdir -p "$out/lib"
    cp -a ${./.venv/lib/python3.12/site-packages}/. "$out/lib"
    chmod -R u+w "$out"
    find "$out" -type d -name __pycache__ -prune -exec rm -rf {} +
  '';
in
pkgs.dockerTools.streamLayeredImage {
  name = "ghcr.io/zaczero/osm-route-distance-feed";
  tag = "latest";
  contents = shell.buildInputs ++ [
    pkgs.dockerTools.caCertificates
    pythonPackages
  ];
  extraCommands = ''
    mkdir -m 1777 tmp
    mkdir -p app/feeds
    cp ${./main.py} app/main.py
  '';
  config = {
    Labels."org.opencontainers.image.source" = "https://github.com/Zaczero/osm-route-distance-feed";
    WorkingDir = "/app";
    Env = [
      "PYTHONPATH=${pythonPackages}/lib"
      "PYTHONUNBUFFERED=1"
      "PYTHONDONTWRITEBYTECODE=1"
    ];
    Entrypoint = [
      "${python}/bin/python3.12"
      "-m"
      "uvicorn"
      "main:app"
    ];
    Cmd = [
      "--host"
      "0.0.0.0"
    ];
    ExposedPorts."8000/tcp" = { };
    Volumes."/app/feeds" = { };
  };
}
