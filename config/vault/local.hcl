ui = true
api_addr = "http://vault:8200"
cluster_addr = "http://vault:8201"

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable = 1
}

default_lease_ttl = "168h"
max_lease_ttl = "720h"
