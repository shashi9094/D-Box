app.get('/dashboard', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

app.get('/createbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'createbox.html'));
});

app.get('/userbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'userbox.html'));
});

app.get('/home', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'home.html'));
});
