import { describe, it, expect } from "vitest";
import { validateUrlSafety, isPrivateOrReservedIp } from "../url-validator.js";
import { AppError } from "../../../middleware/error.middleware.js";

describe("Anti-SSRF URL Validator", () => {
  describe("isPrivateOrReservedIp", () => {
    it("mendeteksi localhost dan loopback IPs", () => {
      expect(isPrivateOrReservedIp("localhost")).toBe(true);
      expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("::1")).toBe(true);
      expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    });

    it("mendeteksi IP privat RFC 1918 (10.x, 172.16-31.x, 192.168.x)", () => {
      expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("10.255.255.255")).toBe(true);
      expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
      expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
      expect(isPrivateOrReservedIp("192.168.0.254")).toBe(true);
    });

    it("mendeteksi cloud metadata link-local IP (169.254.169.254)", () => {
      expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    });

    it("mengizinkan domain atau IP publik", () => {
      expect(isPrivateOrReservedIp("news.detik.com")).toBe(false);
      expect(isPrivateOrReservedIp("kompas.com")).toBe(false);
      expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    });
  });

  describe("validateUrlSafety", () => {
    it("menerima URL publik yang valid dengan protokol http atau https", () => {
      const validUrl1 = validateUrlSafety("https://cekfakta.tempo.co/artikel/123");
      expect(validUrl1.hostname).toBe("cekfakta.tempo.co");

      const validUrl2 = validateUrlSafety("http://turnbackhoax.id/investigasi");
      expect(validUrl2.protocol).toBe("http:");
    });

    it("menolak URL dengan protokol terlarang (ftp, file, javascript)", () => {
      expect(() => validateUrlSafety("ftp://ftp.example.com/file")).toThrow(AppError);
      expect(() => validateUrlSafety("file:///etc/passwd")).toThrow(AppError);
    });

    it("menolak URL dengan kredensial autentikasi", () => {
      expect(() => validateUrlSafety("https://admin:password@example.com")).toThrow(AppError);
    });

    it("menolak URL yang mengarah ke localhost atau IP privat (SSRF protection)", () => {
      expect(() => validateUrlSafety("http://localhost:5000/api/v1/internal")).toThrow(AppError);
      expect(() => validateUrlSafety("http://127.0.0.1:3000")).toThrow(AppError);
      expect(() => validateUrlSafety("http://192.168.1.1/router")).toThrow(AppError);
      expect(() => validateUrlSafety("http://169.254.169.254/latest/meta-data")).toThrow(AppError);
    });
  });
});
