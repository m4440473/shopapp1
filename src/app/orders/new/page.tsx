"use client";
import React, { useState } from "react";

const priorities = ["LOW", "NORMAL", "RUSH", "HOT"];

export default function NewOrderPage() {
	const [orderNumber, setOrderNumber] = useState("");
		const [customerId, setCustomerId] = useState("");
			const [customers, setCustomers] = useState<{id:string, name:string}[]>([]);
			const [showCreateCustomer, setShowCreateCustomer] = useState(false);
			const [newCustomerName, setNewCustomerName] = useState('');
			const [newCustomerContact, setNewCustomerContact] = useState('');
			const [newCustomerPhone, setNewCustomerPhone] = useState('');
			const [newCustomerEmail, setNewCustomerEmail] = useState('');
			const [newCustomerAddress, setNewCustomerAddress] = useState('');
			const [vendors, setVendors] = useState<{id:string, name:string}[]>([]);
			const [materials, setMaterials] = useState<{id:string, name:string}[]>([]);
			const [checklistItems, setChecklistItems] = useState<{id:string, label:string}[]>([]);
			const [vendorId, setVendorId] = useState("");
			const [materialId, setMaterialId] = useState("");
			const [selectedChecklist, setSelectedChecklist] = useState<string[]>([]);
	const [dueDate, setDueDate] = useState("");
	const [priority, setPriority] = useState("NORMAL");
	const [partNumber, setPartNumber] = useState("");
	const [quantity, setQuantity] = useState(1);
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

		// Fetch customers on mount
			React.useEffect(() => {
					fetch("/api/admin/customers?take=100")
						.then(res => res.ok ? res.json() : Promise.reject(res))
						.then(data => setCustomers(data.items ?? data ?? []))
						.catch(() => setCustomers([]));
				fetch("/api/admin/vendors?take=100")
					.then(res => res.ok ? res.json() : Promise.reject(res))
					.then(data => setVendors(data.items ?? []))
					.catch(() => setVendors([]));
				fetch("/api/admin/materials?take=100")
					.then(res => res.ok ? res.json() : Promise.reject(res))
					.then(data => setMaterials(data.items ?? []))
					.catch(() => setMaterials([]));
				fetch("/api/admin/checklist-items?take=100")
					.then(res => res.ok ? res.json() : Promise.reject(res))
					.then(data => setChecklistItems(data.items ?? []))
					.catch(() => setChecklistItems([]));

				// Ensure standard shop checklist items exist (only admins can create via admin API).
				// This is a convenience for dev/demo: if the seed hasn't created these labels,
				// try to create them (the admin guard will reject for non-admin users).
				const standard = [
					"Deburr",
					"Heat Treat",
					"Grind",
					"Stamp",
					"Inspect",
					"Paint",
					"Black Oxide",
					"Plating",
					"Powder Coating",
					"Zinc",
				];

				(async () => {
					try {
						const res = await fetch('/api/admin/checklist-items?take=500');
						if (!res.ok) return; // can't ensure if not admin
						const data = await res.json();
						const existing = (data.items ?? []) as {id:string,label:string}[];
						const existingLabels = new Set(existing.map(i => i.label.toLowerCase()));
						for (const label of standard) {
							if (!existingLabels.has(label.toLowerCase())) {
								// Try to create; admin guard may reject if not admin
								await fetch('/api/admin/checklist-items', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label }) });
							}
						}
						// refresh
						const refreshed = await fetch('/api/admin/checklist-items?take=500');
						if (refreshed.ok) {
							const d2 = await refreshed.json();
							setChecklistItems(d2.items ?? []);
						}
					} catch (e) {
						// ignore
					}
				})();
			}, []);

		async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setMessage("");
			const body = {
				orderNumber,
				customerId,
				modelIncluded: false,
				receivedDate: new Date().toISOString().slice(0, 10),
				dueDate,
				priority,
				materialNeeded: false,
				materialOrdered: false,
				vendorId: vendorId || undefined,
				parts: [{ partNumber, quantity, materialId: materialId || undefined }],
				checklistItemIds: selectedChecklist,
				attachments: [],
				notes,
			};
		const res = await fetch("/api/orders", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (res.ok) {
			setMessage("Order created!");
			setOrderNumber("");
			setCustomerId("");
			setDueDate("");
			setPriority("NORMAL");
			setPartNumber("");
			setQuantity(1);
			setNotes("");
		} else {
			const error = await res.json();
			setMessage(error?.error ? JSON.stringify(error.error) : "Error creating order");
		}
		setLoading(false);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E6EDF3]">
			<form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 bg-[#121821] p-6 rounded-md shadow">
				<h1 className="text-xl font-semibold mb-2">New Order Intake</h1>
				<label className="block text-sm">
					<span className="text-[#9FB1C1]">Order Number</span>
					<input className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required />
				</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Customer</span>
							<select
								className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none"
								value={customerId}
								onChange={e => setCustomerId(e.target.value)}
								required
							>
								<option value="" disabled>Select a customer</option>
								{customers.map(c => (
									<option key={c.id} value={c.id}>{c.name}</option>
								))}
							</select>
								<div className="mt-2">
									<button type="button" onClick={() => setShowCreateCustomer(s => !s)} className="text-sm text-[#34D399] underline">+ Add customer</button>
									{showCreateCustomer && (
										<div className="mt-2 p-2 bg-[#0F1720] rounded">
											<div className="space-y-2">
												<input className="w-full p-2 rounded bg-[#1B2430]" placeholder="Customer name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
												<input className="w-full p-2 rounded bg-[#1B2430]" placeholder="Contact name (optional)" value={newCustomerContact} onChange={e => setNewCustomerContact(e.target.value)} />
												<input className="w-full p-2 rounded bg-[#1B2430]" placeholder="Phone (optional)" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} />
												<input className="w-full p-2 rounded bg-[#1B2430]" placeholder="Email (optional)" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} />
												<textarea className="w-full p-2 rounded bg-[#1B2430]" placeholder="Address (optional)" value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)} />
												<div className="flex gap-2">
													<button type="button" onClick={async () => {
														if (!newCustomerName.trim()) return;
														const payload = {
															name: newCustomerName,
															contact: newCustomerContact || undefined,
															phone: newCustomerPhone || undefined,
															email: newCustomerEmail || undefined,
															address: newCustomerAddress || undefined,
														};
														const res = await fetch('/api/admin/customers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
														if (res.ok) {
															const data = await res.json();
															setCustomers(s => [data.item, ...s]);
															setCustomerId(data.item.id);
															setShowCreateCustomer(false);
															setNewCustomerName('');
															setNewCustomerContact('');
															setNewCustomerPhone('');
															setNewCustomerEmail('');
															setNewCustomerAddress('');
														} else {
															console.error('Failed to create customer');
														}
													}}>Create</button>
													<button type="button" onClick={() => setShowCreateCustomer(false)}>Cancel</button>
												</div>
											</div>
										</div>
									)}
								</div>
						</label>
				<label className="block text-sm">
					<span className="text-[#9FB1C1]">Due Date</span>
					<input type="date" className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
				</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Priority</span>
							<select className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={priority} onChange={e => setPriority(e.target.value)}>
								{priorities.map(p => <option key={p} value={p}>{p}</option>)}
							</select>
						</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Vendor</span>
							<select className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={vendorId} onChange={e => setVendorId(e.target.value)}>
								<option value="">Select vendor (optional)</option>
								{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
							</select>
						</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Part Number</span>
							<input className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={partNumber} onChange={e => setPartNumber(e.target.value)} required />
						</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Material</span>
							<select className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={materialId} onChange={e => setMaterialId(e.target.value)}>
								<option value="">Select material (optional)</option>
								{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
							</select>
						</label>
				<label className="block text-sm">
					<span className="text-[#9FB1C1]">Quantity</span>
					<input type="number" min={1} className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required />
				</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Notes</span>
							<textarea className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none" value={notes} onChange={e => setNotes(e.target.value)} />
						</label>
						<label className="block text-sm">
							<span className="text-[#9FB1C1]">Checklist Items</span>
								<div className="mt-2 grid grid-cols-2 gap-2">
									{checklistItems.map(item => (
										<label key={item.id} className="flex items-center gap-2 text-sm bg-[#0F1720] p-2 rounded">
											<input
												type="checkbox"
												className="w-4 h-4"
												checked={selectedChecklist.includes(item.id)}
												onChange={e => {
													setSelectedChecklist(sel =>
														e.target.checked
															? [...sel, item.id]
															: sel.filter(id => id !== item.id)
													);
												}}
											/>
											<span className="text-[#E6EDF3]">{item.label}</span>
										</label>
									))}
								</div>
						</label>
				<button type="submit" disabled={loading} className="w-full py-2 rounded bg-[#34D399] hover:opacity-90 text-black font-semibold">
					{loading ? "Submitting..." : "Create Order"}
				</button>
				{message && <div className="text-sm mt-2 text-[#34D399]">{message}</div>}
			</form>
		</div>
	);
}