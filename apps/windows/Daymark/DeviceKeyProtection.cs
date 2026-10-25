using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Runtime.Versioning;

namespace Daymark;
[SupportedOSPlatform("windows")]
public static class DeviceKeyProtection
{
    static readonly byte[] Purpose = Encoding.UTF8.GetBytes("daymark-device-key-v1");
    public static object Transform(JsonElement payload, bool protect)
    {
        string value = payload.GetProperty("data").GetString() ?? throw new FormatException("Invalid device key");
        if (value.Length > 4096) throw new FormatException("Invalid device key");
        byte[] input = Convert.FromBase64String(value);
        byte[] output = protect ? ProtectedData.Protect(input, Purpose, DataProtectionScope.CurrentUser)
            : ProtectedData.Unprotect(input, Purpose, DataProtectionScope.CurrentUser);
        return new { data = Convert.ToBase64String(output) };
    }
}
