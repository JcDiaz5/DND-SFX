"""Send email (verification codes, etc.). Uses app config (MAIL_SERVER, etc.)."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app


def send_email(to_email, subject, body_text):
    """
    Send a plain-text email.
    Returns (True, None) if sent, (False, error_message) if not configured or send failed.
    """
    if not current_app.config.get('MAIL_SERVER'):
        current_app.logger.warning('MAIL_SERVER not configured; cannot send email')
        return False, 'Mail server not configured'
    host = current_app.config['MAIL_SERVER']
    port = current_app.config.get('MAIL_PORT', 587)
    use_ssl = current_app.config.get('MAIL_USE_SSL', False)
    use_tls = current_app.config.get('MAIL_USE_TLS', True)
    username = current_app.config.get('MAIL_USERNAME') or None
    password = current_app.config.get('MAIL_PASSWORD') or None
    from_addr = current_app.config.get('MAIL_DEFAULT_SENDER') or username or 'noreply@localhost'
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_addr
        msg['To'] = to_email
        msg.attach(MIMEText(body_text, 'plain'))
        if use_ssl or port == 465:
            server = smtplib.SMTP_SSL(host, port)
        else:
            server = smtplib.SMTP(host, port)
        try:
            if not use_ssl and use_tls:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.sendmail(from_addr, [to_email], msg.as_string())
            return True, None
        finally:
            server.quit()
    except smtplib.SMTPAuthenticationError as e:
        current_app.logger.warning('SMTP authentication failed: %s', e)
        return False, 'Email login failed. Use an app password for Gmail.'
    except Exception as e:
        current_app.logger.exception('Failed to send email: %s', e)
        return False, str(e)
