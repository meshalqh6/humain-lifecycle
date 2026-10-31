import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, Users, Leaf } from "lucide-react";
import { api } from "../services/api";
import { Empty, Failure, Loading, Metric, SectionTitle } from "./ui";

type Group = {
  profession: string;
  total: number;
  saudi: number;
  non_saudi: number;
  rate: number;
};
type Breakdown = { overall: Omit<Group, "profession">; by_profession: Group[] };

export function EmployeeSaudization({
  onViewProfession,
}: {
  onViewProfession: (profession: string) => void;
}) {
  const query = useQuery({
    queryKey: ["/saudization"],
    queryFn: () => api<Breakdown>("/saudization"),
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("profession");
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const { overall, by_profession } = query.data;
  const groups = by_profession
    .filter((g) =>
      g.profession
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "rate"
        ? b.rate - a.rate || a.profession.localeCompare(b.profession)
        : sort === "total"
          ? b.total - a.total || a.profession.localeCompare(b.profession)
          : a.profession.localeCompare(b.profession),
    );
  return (
    <>
      <div className="metrics">
        <Metric
          label="Workforce employees"
          value={overall.total}
          icon={<Users size={18} />}
        />
        <Metric
          label="Saudi employees"
          value={overall.saudi}
          icon={<Leaf size={18} />}
        />
        <Metric
          label="Non-Saudi employees"
          value={overall.non_saudi}
          icon={<Users size={18} />}
        />
        <Metric
          label="Overall Saudization"
          value={overall.total ? `${overall.rate}%` : "—"}
          icon={<Leaf size={18} />}
        />
      </div>
      <section className="panel saudization-panel">
        <SectionTitle
          title="Saudization by profession"
          subtitle="Saudi employees divided by all employees in each profession. Active and onboarding records; archived and inactive employees are excluded."
        />
        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search professions"
              placeholder="Search professions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="saudization-sort">
            Sort by{" "}
            <select
              aria-label="Sort professions"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="profession">Profession name</option>
              <option value="rate">Highest Saudization</option>
              <option value="total">Largest workforce</option>
            </select>
          </label>
        </div>
        {groups.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PROFESSION</th>
                  <th>TOTAL EMPLOYEES</th>
                  <th>SAUDI</th>
                  <th>NON-SAUDI</th>
                  <th>SAUDIZATION</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.profession}>
                    <td>
                      <strong>{g.profession}</strong>
                    </td>
                    <td>{g.total}</td>
                    <td>{g.saudi}</td>
                    <td>{g.non_saudi}</td>
                    <td>
                      <div className="saudization-rate">
                        <strong>{g.rate}%</strong>
                        <progress
                          aria-label={`${g.profession} Saudization`}
                          max={100}
                          value={g.rate}
                        />
                      </div>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`View employees in ${g.profession}`}
                        onClick={() => onViewProfession(g.profession)}
                      >
                        View employees <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              overall.total
                ? "No matching professions"
                : "No workforce employees yet"
            }
          >
            {overall.total
              ? "Try another profession name."
              : "Add an active or onboarding employee to see the breakdown."}
          </Empty>
        )}
        <p className="saudization-note">
          Based on recorded nationality aliases, including Saudi, Saudi Arabian,
          Saudi Arabia, SA, KSA and Arabic Saudi spellings. Other recorded
          values count as non-Saudi. These workforce percentages are
          descriptive, not an official Nitaqat classification.
        </p>
      </section>
    </>
  );
}
