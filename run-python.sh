#!/bin/bash
export PYTHONPATH="/var/data/python/lib/python3.13/site-packages:/app/lib/python3.13/site-packages"
export PYTHONUSERBASE="/var/data/python"
exec /usr/bin/python3 "$@"
