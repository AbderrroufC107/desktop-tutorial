<?php
// NFC RS settings. Copy this file to config.php and fill in your values.

return [
    // cPanel → MySQL Databases: the database, user and password you created.
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_nfcrs',
    'db_user' => 'cpaneluser_nfcrs',          // or a list: ['cpaneluser_nfcrs', 'nfcrs']
    'db_pass' => 'CHANGE-ME',

    // Accounts with these e-mails can open admin.html (cards and customers).
    'admin_emails' => ['you@example.com'],

    // Optional "Continue with Google": an OAuth Web client ID from Google Cloud Console.
    // Leave empty to hide the Google button and use e-mail + password only.
    'google_client_id' => '',

    // Sender address for password-reset e-mails (an address on your domain works best).
    'mail_from' => 'no-reply@example.com',
];
