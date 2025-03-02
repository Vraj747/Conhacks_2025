document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('enableExtension').addEventListener('change', function() {
    // Handle toggle logic here
  });

  let reconsideredCount = 0;
  let moneySaved = 0;
  let co2Saved = 0;

  document.getElementById('confirmYes').addEventListener('click', function() {
    reconsideredCount++;
    moneySaved += 20; // Example savings
    co2Saved += 0.5; // Example CO2 saving
    document.getElementById('reconsideredCount').textContent = reconsideredCount;
    document.getElementById('moneySaved').textContent = `$${moneySaved}`;
    document.getElementById('co2Saved').textContent = `${co2Saved} kg`;
    document.getElementById('confirmationOverlay').style.display = 'none';
  });

  document.getElementById('confirmNo').addEventListener('click', function() {
    document.getElementById('confirmationOverlay').style.display = 'none';
  });

  // Trigger confirmation popup when clicking on purchase button
  function showConfirmation() {
    document.getElementById('confirmationOverlay').style.display = 'flex';
  }
}); 