const Router = require('koa-router');
const router = new Router();
const connection = require('../app/db');
const {v4: uuid} = require('uuid');
const transporter = require('../app/mail');
const app = require('../app/app');
const config = require('../config.json');

router.get('/renew-mail-auth', async (ctx) => {
    let session = ctx.session;
    app.initializeSession(session);

    let authId = session.auth_id;
    let userId = await app.getUserId(authId);
    if (userId) {
        session.error.message = '既にログインしています';

        return ctx.redirect('/');
    }

    let result = app.initializeRenderResult();
    result['data']['meta']['login_status'] = false;
    result['data']['meta']['site_title'] = 'メールアドレス認証 - Medice Note';
    result['data']['meta']['seo']['bool'] = true;
    result['data']['meta']['seo']['description'] = 'Medice Noteのメールアドレス認証を再発行';
    result['data']['meta']['seo']['url'] = 'https://www.medice-note.vxx0.com/renew-mail-auth';

    if (session.success !== undefined) {
        result['data']['success'] = session.success;
        session.success = undefined;
    }

    if (session.error.message !== undefined) {
        result['data']['error'] = session.error;
        session.error = undefined;
    }

    await ctx.render('renew-mail-auth', result);
});

router.post('/renew-mail-auth', async (ctx) => {
    let session = ctx.session;
    app.initializeSession(session);

    let mail = ctx.request.body['mail'];

    let sql = 'SELECT user_id FROM user WHERE mail = ? AND is_enable = false AND deleted_at IS NULL';
    let [user] = await connection.query(sql, [mail]);
    if (user.length === 0) {
        session.error.message = 'アカウントが見つかりませんでした';

        return ctx.redirect('/renew-mail-auth');
    }

    let userId = user[0]['user_id'];
    let authKey = uuid().split('-').join('');

    let date = new Date();
    date.setHours(date.getHours() + 24);
    await connection.query('INSERT INTO user_authentication_key VALUES (?, ?, ?)', [userId, authKey, date]);

    await transporter.sendMail({
        from: config.mail.auth.user,
        to: mail,
        subject: 'メールアドレス認証',
        text: '登録いただきありがとうございます\n' +
            'アカウントを有効化するには下記のURLにアクセスしメールアドレスを認証してください\n' +
            'https://www.medice-note.vxx0.com/auth-mail/' + authKey
    }).then(() => {
        session.success.message = '認証メールを送信しました';

        ctx.redirect('/renew-mail-auth');
    }).catch(() => {
        session.error.message = '認証メールの送信に失敗しました';

        ctx.redirect('/signup');
    });
});

module.exports = router;