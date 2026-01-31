
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './views/Home';
import SpecLedger from './views/SpecLedger';
import ProductDetail from './views/ProductDetail';
import Comparison from './views/Comparison';
import Contribute from './views/Contribute';
import Coverage from './views/Coverage';
import Contact from './views/Contact';
import Diagnostics from './views/Diagnostics';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/specs" element={<SpecLedger />} />
          <Route path="/specs/:slug" element={<ProductDetail />} />
          <Route path="/compare/:slugPair" element={<Comparison />} />
          <Route path="/contribute" element={<Contribute />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
