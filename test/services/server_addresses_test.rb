require "test_helper"

class ServerAddressesTest < ActiveSupport::TestCase
  def interfaces(*ips)
    ips.map { |ip| Addrinfo.ip(ip) }
  end

  test "lists home network addresses before Tailscale ones" do
    addresses = ServerAddresses.new(
      interfaces: interfaces("127.0.0.1", "100.101.102.103", "192.168.1.20", "10.0.0.5"),
      container: false
    )

    assert_equal [
      { ip: "192.168.1.20", network: "home" },
      { ip: "10.0.0.5", network: "home" },
      { ip: "100.101.102.103", network: "tailscale" }
    ], addresses.reachable
  end

  test "skips loopback, link-local, public and IPv6 addresses" do
    addresses = ServerAddresses.new(
      interfaces: interfaces("127.0.0.1", "169.254.10.1", "203.0.113.7", "::1", "fe80::1", "fd00::1"),
      container: false
    )

    assert_empty addresses.reachable
  end

  test "reports nothing inside a container, where its addresses are unreachable" do
    addresses = ServerAddresses.new(interfaces: interfaces("172.17.0.2"), container: true)

    assert_empty addresses.reachable
  end

  test "recognises loopback hosts" do
    %w[localhost 127.0.0.1 127.0.1.1 ::1 [::1]].each do |host|
      assert ServerAddresses.loopback_host?(host), host
    end

    %w[192.168.1.20 cookbook.lan www.example.com localhost.example.com].each do |host|
      assert_not ServerAddresses.loopback_host?(host), host
    end
  end
end
