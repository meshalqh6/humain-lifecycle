import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { Button, Modal, Badge } from "./ui";

export function RosterImport() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  async function inspect(f: File) {
    setBusy(true);
    const data = new FormData();
    data.append("file", f);
    try {
      const result = await api("/employees/import?synthetic=true", {
        method: "POST",
        body: data,
      });
      setFile(f);
      setPreview(result);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!file) return;
    setBusy(true);
    const data = new FormData();
    data.append("file", file);
    try {
      const result = await api(
        "/employees/import?synthetic=true&confirm_authorized=true",
        { method: "POST", body: data },
      );
      toast.success(
        `${result.created} created; ${result.duplicates_prevented} duplicates prevented`,
      );
      setPreview(null);
      setFile(null);
      await client.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button secondary busy={busy} onClick={() => input.current?.click()}>
        <Upload size={15} />
        Import roster
      </Button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".csv,.xlsx"
        onChange={(e) => {
          if (e.target.files?.[0]) void inspect(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Review synthetic roster"
        description="Preview only. No employees are created until you choose Import authorized file."
      >
        {preview && (
          <>
            <Badge>{preview.count} employee rows</Badge>
            <p className="subtle">
              Use synthetic data in this development workspace. Expected legacy
              headers: Employee Name, Iqama Number, Nationality, Profession,
              Email and the Sadiah date columns. For real records, use the
              authenticated API with synthetic=false only after explicit
              authorization.
            </p>
            {preview.errors.map((x: any) => (
              <p className="review-issue" key={x.row}>
                Row {x.row}: {x.message}
              </p>
            ))}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>NUMBER</th>
                    <th>NATIONALITY</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.records.slice(0, 10).map((r: any) => (
                    <tr key={r.employee.employee_number}>
                      <td>{r.employee.name}</td>
                      <td>{r.employee.employee_number}</td>
                      <td>{r.employee.nationality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <Button secondary onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                busy={busy}
                disabled={!!preview.errors.length}
                onClick={commit}
              >
                Import authorized file
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
