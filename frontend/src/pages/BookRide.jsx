import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { apiFetch } from '../utils/api';
import { Car, Zap, Loader2, Compass, CheckCircle2, Navigation, MapPin, User as UserIcon } from 'lucide-react';
import LeafletMap from '../components/LeafletMap';
import './BookRide.css';

const premiumVehicles = [
  { type: 'motorcycle', label: 'Swift (Bike)', icon: <Zap size={22} />, capacity: 1, baseFare: 20, perKm: 8 },
  { type: 'auto', label: 'Urban (Auto)', icon: <Compass size={22} />, capacity: 3, baseFare: 30, perKm: 12 },
  { type: 'car', label: 'Prime (Car)', icon: <Car size={22} />, capacity: 4, baseFare: 50, perKm: 18 },
  { type: 'van', label: 'Max (Van)', icon: <Car size={22} />, capacity: 6, baseFare: 80, perKm: 25 },
];

const formatDuration = (totalMinutes) => {
  const mins = Math.ceil(totalMinutes);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainderMins = mins % 60;
  return remainderMins === 0 ? `${hours} hr` : `${hours} hr ${remainderMins} min`;
};

export default function BookRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  
  const [pickup, setPickup] = useState(location.state?.pickup || '');
  const [destination, setDestination] = useState(location.state?.destination || '');
  const [step, setStep] = useState((location.state?.pickup && location.state?.destination) ? 2 : 1);
  
  const [selectedVehicle, setSelectedVehicle] = useState('car');
  const [isConfirming, setIsConfirming] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  
  const [isFetchingFares, setIsFetchingFares] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distance: '...', time: '...' });
  
  // Real-time Ride State
  const [activeRideId, setActiveRideId] = useState(null);
  const [activeRideData, setActiveRideData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  // Bind Socket Responders
  useEffect(() => {
    if (!socket) return;
    
    // Server says no driver found after timeout
    socket.on('ride-timeout', (data) => {
      alert(data.message);
      setStep(2); setIsConfirming(false); setActiveRideId(null);
    });

    // Server announces state changes globally across the room
    socket.on('ride_status_update', (data) => {
      if (data.status === 'accepted') {
        setStep(4);
        fetchActiveRideData(data.rideId);
      } else if (data.status === 'completed') {
        alert("Trip Successfully Completed! Thank you for riding with RideFlow.");
        navigate('/history');
      } else if (data.status === 'cancelled') {
        alert("Ride was cancelled.");
        navigate('/dashboard');
      }
    });

    // Driver broadcasts pure live location array map markers
    socket.on('driver_location_update', (coords) => {
      setDriverLocation([coords.lng, coords.lat]);
    });

    // Gracefully handle server-identified dropped packets
    socket.on('driver_disconnected', (data) => {
      alert(data.message);
    });

    return () => {
      socket.off('ride-timeout');
      socket.off('ride_status_update');
      socket.off('driver_location_update');
      socket.off('driver_disconnected');
    };
  }, [socket, navigate]);

  const fetchActiveRideData = async (rideId) => {
    try {
      const res = await apiFetch(`/rides/${rideId}`);
      setActiveRideData(res.data);
    } catch(e) { console.error('Failed fetching active ride stats', e); }
  };

  const handleRouteCalculated = ({ distanceKm, durationMin, pCoords, dCoords }) => {
    const hydratedVehicles = premiumVehicles.map(v => {
       const finalFare = (v.baseFare + (v.perKm * distanceKm));
       let addedMinutes = v.type === 'auto' ? 2 : v.type === 'car' ? 5 : v.type === 'van' ? 8 : 1;
       const durationSeconds = addedMinutes * 60;

       const getPickupTime = (seconds) => {
         const now = new Date();
         const pickupTime = new Date(now.getTime() + seconds * 1000);
         return pickupTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
       };
       
       return {
         ...v,
         fare: `₹${Math.round(finalFare)}`,
         etaText: `Arrives in ${addedMinutes} min`,
         pickupTimeText: `Pickup at ${getPickupTime(durationSeconds)}`
       };
    });

    setRouteInfo({
      distance: `${distanceKm.toFixed(1)} km`,
      time: formatDuration(durationMin),
      pickupLocation: pCoords,
      destLocation: dCoords
    });

    setVehicles(hydratedVehicles);
    setIsFetchingFares(false);
  };

  useEffect(() => {
    if (step === 2 && vehicles.length === 0) setIsFetchingFares(true);
  }, [step]);

  const handleSearch = () => {
    if (pickup && destination) {
      setStep(2); setIsFetchingFares(true);
    }
  };

  const isFormValid = () => {
    if (paymentMethod === 'UPI' && !upiId.includes('@')) return false;
    if (paymentMethod === 'Card' && cardNumber.length < 16) return false;
    return true;
  };

  const handleConfirm = async () => {
    const pickupCoords = routeInfo.pickupLocation;
    const dropCoords = routeInfo.destLocation;
    const selectedVehicleData = vehicles.find((vehicle) => vehicle.type === selectedVehicle);
    const calculatedFare = selectedVehicleData ? Number(String(selectedVehicleData.fare).replace(/[^\d.]/g, '')) : null;

    if (!pickupCoords || !dropCoords) {
      alert("Please select valid locations");
      return;
    }

    if (!selectedVehicle) {
      alert("Please select a vehicle");
      return;
    }

    if (!Number.isFinite(calculatedFare)) {
      alert("Fare is not ready yet");
      return;
    }

    setIsConfirming(true);
    try {
      const payload = {
        userId: user._id,
        pickup: {
          address: pickup,
          location: { type: "Point", coordinates: [pickupCoords[1], pickupCoords[0]] },
        },
        destination: {
          address: destination,
          location: { type: "Point", coordinates: [dropCoords[1], dropCoords[0]] },
        },
        vehicleType: selectedVehicle,
        fare: {
          estimatedFare: calculatedFare,
        },
        paymentMethod: paymentMethod.toLowerCase(),
      };

      console.log("BOOKING PAYLOAD:", payload);

      const res = await apiFetch('/rides', {
        method: 'POST',
        headers: {
          'Idempotency-Key': `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify(payload)
      });
      if (!res?.success || !res?.data?.ride) {
        throw new Error(res?.message || 'Unable to create ride.');
      }
      
      const newRideId = res.data.ride._id;
      setActiveRideId(newRideId);
      
      if (socket) socket.emit('join_ride', newRideId);
      
      // Render the matching loop purely frontend side
      setStep(3);
    } catch (error) {
      console.error("BOOKING ERROR:", error);
      alert("Failed to book ride: " + error.message);
      setIsConfirming(false);
    }
  };

  return (
    <div className="fintech-booking-container animate-fade-in-up">
      
      {/* LEFT PANEL */}
      <div className="fintech-ride-panel">
        <div className="fintech-scroll-content">
          
          {step === 1 && (
             <>
               <div className="fintech-panel-header">
                 <h2>Plan your journey</h2>
                 <p>Enter your pickup and drop-off locations to proceed.</p>
               </div>
               
               <div className="fintech-input-group">
                  <div className="fintech-field">
                    <div className="dot pickup" />
                    <input type="text" placeholder="Pickup location" value={pickup} onChange={e => setPickup(e.target.value)} />
                  </div>
                  <div className="fintech-field">
                    <div className="dot dropoff" />
                    <input type="text" placeholder="Drop-off location" value={destination} onChange={e => setDestination(e.target.value)} />
                  </div>
               </div>

               <button className="btn-primary" onClick={handleSearch} disabled={!pickup || !destination} style={{ width: '100%', padding: '16px', fontSize: '15px' }}>
                 Calculate Routing <Navigation size={16} />
               </button>
             </>
          )}

          {step === 2 && (
             <>
               <div className="fintech-readonly-header">
                 <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Review routing</h2>
                 <button className="fintech-btn-edit" onClick={() => { setStep(1); setVehicles([]); }}>Edit Route</button>
               </div>

               <div className="fintech-section-title">Select your ride</div>

               {isFetchingFares ? (
                 <div className="flex-center" style={{ padding: '40px', color: 'var(--text-muted)', flexDirection: 'column' }}>
                   <Loader2 className="spin" size={28} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                   <p style={{ fontSize: '14px', fontWeight: '600' }}>Fetching live rates...</p>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   {vehicles.map(v => (
                     <div 
                       key={v.type}
                       className={`fintech-ride-option ${selectedVehicle === v.type ? 'selected' : ''}`}
                       onClick={() => setSelectedVehicle(v.type)}
                     >
                       <div className="fintech-ride-icon">{v.icon}</div>
                       <div className="fintech-ride-details">
                         <div className="fintech-ride-name">{v.label}</div>
                         <div className="fintech-ride-meta" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                           <span>{v.capacity} seats • {v.etaText}</span>
                           <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{v.pickupTimeText}</span>
                         </div>
                       </div>
                       <div className="fintech-ride-price">{v.fare}</div>
                       {selectedVehicle === v.type && <CheckCircle2 size={18} color="var(--primary)" style={{ marginLeft: '8px' }} />}
                     </div>
                   ))}

                   <div className="fintech-section-title">Payment Method</div>
                   
                   <div className="fintech-segmented-control">
                     {['UPI', 'Card', 'Cash'].map(pm => (
                       <button 
                         key={pm} 
                         className={`fintech-segment-btn ${paymentMethod === pm ? 'active' : ''}`}
                         onClick={() => setPaymentMethod(pm)}
                       >
                         {pm}
                       </button>
                     ))}
                   </div>

                   {paymentMethod === 'UPI' && (
                     <input type="text" className="fintech-payment-input animate-fade-in" placeholder="UPI ID (e.g. name@okhdfc)" value={upiId} onChange={e => setUpiId(e.target.value)} />
                   )}
                   {paymentMethod === 'Card' && (
                     <input type="text" className="fintech-payment-input animate-fade-in" placeholder="Card Number (16 Digits)" maxLength="16" value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, ''))} />
                   )}
                 </div>
               )}
             </>
          )}

          {step === 3 && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', background: '#EFF6FF', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', position: 'relative'
              }}>
                <Loader2 className="spin" size={40} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 12px' }}>Locating Nearby Drivers</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Please hold on while we securely connect your ride with the nearest available driver network.</p>
            </div>
          )}

          {step === 4 && activeRideData && (
            <div style={{ padding: '24px 8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Driver is en route</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Please gather your belongings.</p>
              
              <div style={{ background: '#F8FAFC', border: '1px solid var(--border-light)', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={24} color="var(--text-muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{activeRideData.driver?.fullname?.firstname}</h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                    {activeRideData.driver?.vehicle?.plate} • {activeRideData.driver?.vehicle?.color}
                  </div>
                </div>
                <div style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '18px' }}>
                  {activeRideData.otp?.code || 'OTP'}
                </div>
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Status</span>
                  <span style={{ fontWeight: 800, textTransform: 'capitalize' }}>{activeRideData.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Fare</span>
                  <span style={{ fontWeight: 800 }}>₹{activeRideData.fare?.estimatedFare}</span>
                </div>
              </div>
            </div>
          )}

        </div>
        
        {step === 2 && !isFetchingFares && (
          <div className="fintech-panel-footer">
             <button className="btn-fintech-submit" onClick={handleConfirm} disabled={isConfirming || !isFormValid() || !routeInfo.pickupLocation || !routeInfo.destLocation || !selectedVehicle}>
               {isConfirming ? <><Loader2 className="spin" size={18} /> Processing Request</> : 'Confirm your journey'}
             </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL MAP */}
      <div className="fintech-map-container">
        <LeafletMap 
          pickupStr={step < 4 ? pickup : null} 
          destinationStr={step < 4 ? destination : null} 
          onRouteCalculated={handleRouteCalculated}
          nearbyDrivers={driverLocation ? [{ _id: 'live-driver', location: { lat: driverLocation[1], lng: driverLocation[0] } }] : []}
        />
      </div>

    </div>
  );
}
