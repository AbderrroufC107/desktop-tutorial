<?php
// NFC RS settings. Copy this file to config.php and fill in your values.

return [
    // cPanel → MySQL Databases: the database, user and password you created.
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_nfcrs',
    'db_user' => 'cpaneluser_nfcrs',          // or a list: ['cpaneluser_nfcrs', 'nfcrs']
    'db_pass' => 'CHANGE-ME',

    // One-time link that makes the first signed-in account the main admin:
    //   https://your-domain.com/admin.html?setup=THIS-KEY
    // It stops working as soon as an admin exists. Use a long random value.
    'setup_key' => 'CHANGE-ME-to-a-long-random-key',

    // Optional: e-mails that are always admins (more can be added from admin.html).
    'admin_emails' => [],

    // Optional "Continue with Google": an OAuth Web client ID from Google Cloud Console.
    // Leave empty to hide the Google button and use e-mail + password only.
    'google_client_id' => '',

    // Sender address for password-reset e-mails (an address on your domain works best).
    'mail_from' => 'no-reply@example.com',
];
