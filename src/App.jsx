import './App.css'
import DispatchCockpitUI from './DispatchCockpitUI.jsx'
import { SHIPPED_ORDER_SUMMARY_ORDERS } from './shippedOrders.generated.js'
import { AGG_TRUCK_ASSIGNMENTS } from './aggTruckAssignments.generated.js'

function App() {
  return (
    <DispatchCockpitUI
      ordersData={SHIPPED_ORDER_SUMMARY_ORDERS}
      assignmentData={AGG_TRUCK_ASSIGNMENTS}
    />
  )
}

export default App
