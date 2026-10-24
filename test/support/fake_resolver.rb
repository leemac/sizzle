# Stands in for Resolv in tests so SafeHttp's address checks run without DNS.
class FakeResolver
  PUBLIC_IP = "93.184.215.14".freeze

  def initialize(hosts = {})
    @hosts = hosts
  end

  def getaddresses(host)
    Array(@hosts.fetch(host, PUBLIC_IP))
  end
end
