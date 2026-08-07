function initDatePicker(containerId, hiddenInputEl, options = {}) {
  const container = document.getElementById(containerId);
  container.className = "date-picker-row";

  const input = document.createElement("input");
  input.type = "date";

  const currentYear = new Date().getFullYear();
  const yearsBack = options.yearsBack ?? 1;
  const yearsForward = options.yearsForward ?? 5;
  input.min = `${currentYear - yearsBack}-01-01`;
  input.max = `${currentYear + yearsForward}-12-31`;

  container.innerHTML = "";
  container.appendChild(input);

  input.addEventListener("change", () => {
    hiddenInputEl.value = input.value;
    hiddenInputEl.dispatchEvent(new Event("change"));
  });

  function setValue(isoDate) {
    input.value = isoDate || "";
    hiddenInputEl.value = isoDate || "";
  }

  return { setValue, clear: () => setValue(null) };
}
