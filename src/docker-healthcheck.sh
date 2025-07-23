#!/bin/sh
curl --fail http://localhost:3000/health || exit 1 