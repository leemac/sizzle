require "test_helper"

class ShortcutConnectionTest < ActiveSupport::TestCase
  test "pairing and device credentials are stored as digests and pairing is single use" do
    connection, code = ShortcutConnection.issue!(name: "Kitchen phone")
    assert_not_includes connection.attributes.values, code
    token = ShortcutConnection.redeem(code)
    assert token
    assert_equal connection, ShortcutConnection.authenticate(token)
    assert_not_includes connection.reload.attributes.values, token
    assert_nil connection.pairing_digest
    assert_nil ShortcutConnection.redeem(code)
  end

  test "expired and cancelled pairing codes cannot be redeemed" do
    connection, code = ShortcutConnection.issue!(name: "Kitchen phone")
    travel_to connection.pairing_expires_at, with_usec: true do
      assert_nil ShortcutConnection.redeem(code)
    end
    connection.revoke!
    assert_nil ShortcutConnection.redeem(code)
  end

  test "revocation immediately invalidates a credential" do
    connection, code = ShortcutConnection.issue!(name: "Kitchen phone")
    token = ShortcutConnection.redeem(code)
    connection.reload.revoke!
    assert_nil ShortcutConnection.authenticate(token)
    assert_nil connection.credential_digest
  end

  test "rejects missing malformed and unknown credentials and pairing codes" do
    [ nil, "", "a" * 64, [], {}, "x" * 100_000 ].each do |input|
      assert_nil ShortcutConnection.redeem(input)
      assert_nil ShortcutConnection.authenticate(input)
    end
  end

  test "names and the number of connections are bounded and expired requests are cleaned up" do
    assert_raises(ActiveRecord::RecordInvalid) { ShortcutConnection.issue!(name: "") }
    assert_raises(ActiveRecord::RecordInvalid) { ShortcutConnection.issue!(name: "x" * 61) }
    ShortcutConnection::MAX_CONNECTIONS.times { ShortcutConnection.issue!(name: "Phone") }
    assert_raises(ArgumentError) { ShortcutConnection.issue!(name: "Another") }
    travel ShortcutConnection::PAIRING_LIFETIME + 1.second do
      assert ShortcutConnection.issue!(name: "New connection")
      assert_equal 1, ShortcutConnection.count
    end
  end
end
