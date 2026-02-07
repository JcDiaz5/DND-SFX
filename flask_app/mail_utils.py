"""Send email (verification codes, etc.). Uses app config (MAIL_SERVER, etc.)."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app


def send_email(to_email, subject, body_text):
    """Send a plain-text email. Returns True if sent, False if mail not configured or send failed."""
    if not current_app.config.get('MAIL_SERVER'):
        current_app.logger.warning('MAIL_SERVER not configured; cannot send email')
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = current_app.config.get('MAIL_DEFAULT_SENDER', '')
        msg['To'] = to_email
        msg.attach(MIMEText(body_text, 'plain'))
        with smtplib.SMTP(
            current_app.config['MAIL_SERVER'],
            current_app.config.get('MAIL_PORT', 587),
        ) as server:
            if current_app.config.get('MAIL_USE_TLS'):
                server.starttls()
            username = current_app.config.get('MAIL_USERNAME')
            password = current_app.config.get('MAIL_PASSWORD')
            if username and password:
                server.login(username, password)
            server.sendmail(msg['From'], [to_email], msg.as_string())
        return True
    except Exception as e:
        current_app.logger.exception('Failed to send email: %s', e)
        return False
