#!/usr/bin/env bash
# Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

echo "Downloading the list of dependencies"
mkdir -p .lib
echo "Downloading splice-api-token-metadata-v1"
curl -L# -o .lib/splice-api-token-metadata-v1.dar https://github.com/hyperledger-labs/splice/raw/refs/heads/main/daml/dars/splice-api-token-metadata-v1-1.0.0.dar
echo "Downloading splice-api-token-holding-v1"
curl -L# -o .lib/splice-api-token-holding-v1.dar https://github.com/hyperledger-labs/splice/raw/refs/heads/main/daml/dars/splice-api-token-holding-v1-1.0.0.dar
echo "Downloading splice-api-token-transfer-instruction-v1"
curl -L# -o .lib/splice-api-token-transfer-instruction-v1.dar https://github.com/hyperledger-labs/splice/raw/refs/heads/main/daml/dars/splice-api-token-transfer-instruction-v1-1.0.0.dar
echo "Downloading splice-api-token-allocation-v1"
curl -L# -o .lib/splice-api-token-allocation-v1.dar https://github.com/hyperledger-labs/splice/raw/refs/heads/main/daml/dars/splice-api-token-allocation-v1-1.0.0.dar
echo "Downloading splice-api-token-allocation-instruction-v1"
curl -L# -o .lib/splice-api-token-allocation-instruction-v1.dar https://github.com/hyperledger-labs/splice/raw/refs/heads/main/daml/dars/splice-api-token-allocation-instruction-v1-1.0.0.dar
