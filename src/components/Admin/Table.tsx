import React from 'react';

export default function Table({ columns = [], rows = [], onEdit = () => {} }: any) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[#9FB1C1]">
        <tr>
          {columns.map((c:any) => <th key={c.key} className="py-2">{c.header}</th>)}
          <th className="py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r:any) => (
          <tr key={r.id} className="border-t border-[#16202A]">
            {columns.map((c:any) => <td key={c.key} className="py-2">{String(r[c.key] ?? '')}</td>)}
            <td className="py-2">
              <button className="px-2 py-1 mr-2 rounded border" onClick={() => onEdit(r)}>Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
