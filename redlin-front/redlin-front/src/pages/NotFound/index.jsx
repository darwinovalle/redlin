import { Link } from 'react-router-dom';
import notFoundPet from '../../assets/redlin_logo/404_not_found.png';
import './NotFound.css';

const NotFound = () => {
  return (
    <main className="not-found-page">
      <figure className="not-found-pet-wrap" aria-hidden="true">
        <div className="not-found-orbit not-found-orbit-one" />
        <div className="not-found-orbit not-found-orbit-two" />
        <img className="not-found-pet" src={notFoundPet} alt="" />
      </figure>

      <section className="not-found-card" aria-labelledby="not-found-title">
        <p className="not-found-code">404</p>
        <h1 id="not-found-title">Oops! This page is off the study map.</h1>
        <p className="not-found-text">
          Your Redlin pet searched every corner and could not find this route.
          Let&apos;s get you back to a learning mission.
        </p>
        <div className="not-found-actions">
          <Link className="not-found-btn not-found-btn-primary" to="/home">
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
