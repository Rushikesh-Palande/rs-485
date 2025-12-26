class AppError(Exception):
    """Base application error (domain + infra)."""


class ConfigError(AppError):
    """Configuration is invalid or missing critical values."""


class FrameDecodeError(AppError):
    """Serial bytes could not be decoded into a valid RS-485 frame."""


class TelemetryParseError(AppError):
    """Decoded frame exists but mapping/register parsing failed."""
