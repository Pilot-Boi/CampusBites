import flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask import request, render_template, redirect, flash, Flask, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
app.secret_key = "supersecretkey"
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# USER MODEL
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True)
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(64))

    def __repr__(self):
        return '<User {}>'.format(self.username)
    
    def set_password(self, password):
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password, password)

# INITIALIZE DATABASE
with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.context_processor
def inject_user():
    return dict(user=current_user)

# LOGIN PAGE
@app.route('/', methods=['GET', 'POST'])
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=True)  # Flask-Login logs the user in
            return redirect(url_for('profile', user_id=user.id))
        else:
            flash("Invalid username or password. Please try again.")
            return redirect('/login')
    
    return render_template('login.html')

# PROFILE PAGE
@app.route('/profile/<int:user_id>')
@login_required
def profile(user_id):
    return render_template('profile.html', user=current_user)

# EVENTS PAGE
@app.route('/events')
@login_required
def events():
    return render_template('events.html')

# CONTACT PAGE
@app.route('/contact')
@login_required
def contact():
        return render_template('contact.html')

# CALENDAR PAGE
@app.route('/calendar/<int:user_id>')
@login_required
def calendar(user_id):
        return render_template('calendar.html', user=current_user)

# ABOUT PAGE
@app.route('/about')
@login_required
def about():
        return render_template('about.html')


# LOGOUT
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect('/login')

# REGISTRATION PAGE (Optional)
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        email = request.form['email']
        if User.query.filter_by(username=username).first():
            flash("Username already exists")
            return redirect('/register')
        
        if User.query.filter_by(email=email).first():
            flash("Email already registered")
            return redirect('/register')
        
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        flash("Registration successful! Please login.")
        return redirect('/login')
    return render_template('register.html') 

if __name__ == '__main__':
    app.run(debug=True)
    